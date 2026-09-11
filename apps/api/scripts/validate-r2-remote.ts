import 'dotenv/config';
import { AwsClient } from 'aws4fetch';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const endpoint = new URL(required('R2_ENDPOINT'));
const bucket = required('R2_BUCKET');
const accessKeyId = required('R2_ACCESS_KEY_ID');
const secretAccessKey = required('R2_SECRET_ACCESS_KEY');
const key = `cloudflare-validation/${crypto.randomUUID()}.bin`;
if (!key.startsWith('cloudflare-validation/')) throw new Error('Unsafe validation key');

const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
const objectUrl = new URL(`${endpoint.toString().replace(/\/$/, '')}/${bucket}/${key}`);
const payload = crypto.getRandomValues(new Uint8Array(4096));
const digest = async (bytes: Uint8Array): Promise<string> => {
  const result = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(result)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};
const sign = async (method: string, contentType?: string, datetime?: string, expires = 120) => {
  const url = new URL(objectUrl);
  url.searchParams.set('X-Amz-Expires', String(expires));
  return client.sign(url, {
    method,
    ...(contentType ? { headers: { 'Content-Type': contentType } } : {}),
    aws: { signQuery: true, allHeaders: true, ...(datetime ? { datetime } : {}) },
  });
};

let uploaded = false;
try {
  const put = await sign('PUT', 'application/octet-stream');
  for (const origin of ['http://localhost:5179', 'https://dropthing.mtnz.app']) {
    const preflight = await fetch(put.url, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    if (!preflight.ok || preflight.headers.get('access-control-allow-origin') !== origin) {
      throw new Error(`CORS preflight failed for ${origin} (${preflight.status})`);
    }
  }

  const wrongMethod = await fetch(put.url);
  if (wrongMethod.status !== 403)
    throw new Error(`PUT signature accepted GET (${wrongMethod.status})`);
  const wrongHeader = await fetch(put.url, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: payload,
  });
  if (wrongHeader.status !== 403)
    throw new Error(`Signed Content-Type was not enforced (${wrongHeader.status})`);
  const expired = await sign('PUT', 'application/octet-stream', '20200101T000000Z', 1);
  const expiredUpload = await fetch(expired.url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: payload,
  });
  if (expiredUpload.status !== 403)
    throw new Error(`Expired signature was accepted (${expiredUpload.status})`);

  const upload = await fetch(put.url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream', Origin: 'http://localhost:5179' },
    body: payload,
  });
  if (!upload.ok) throw new Error(`Signed PUT failed (${upload.status})`);
  uploaded = true;

  const head = await fetch(await sign('HEAD'));
  if (!head.ok || Number(head.headers.get('content-length')) !== payload.byteLength) {
    throw new Error(`Signed HEAD failed or returned the wrong size (${head.status})`);
  }

  const get = await fetch(await sign('GET'));
  if (!get.ok || !get.body) throw new Error(`Signed GET failed (${get.status})`);
  const reader = get.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    chunks.push(part.value);
    length += part.value.byteLength;
  }
  const downloaded = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    downloaded.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const [expectedHash, actualHash] = await Promise.all([digest(payload), digest(downloaded)]);
  if (expectedHash !== actualHash) throw new Error('Downloaded object fingerprint differs');
  console.log(
    JSON.stringify({
      ok: true,
      keyPrefix: 'cloudflare-validation/',
      bytes: length,
      sha256: actualHash,
      corsOrigins: 2,
      rejectedWrongMethod: true,
      rejectedWrongContentType: true,
      rejectedExpiredSignature: true,
    })
  );
} finally {
  if (uploaded) {
    const deletion = await fetch(await sign('DELETE'));
    if (!deletion.ok) {
      console.error(`Cleanup DELETE failed (${deletion.status})`);
      process.exitCode = 1;
    }
    const absent = await fetch(await sign('HEAD'));
    if (absent.status !== 404) {
      console.error(`Validation object still exists (${absent.status})`);
      process.exitCode = 1;
    }
  }
}
