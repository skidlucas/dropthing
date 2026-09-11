import { Client } from 'pg';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import type { TransferDrop, TransferEnvelope } from './model.js';
import { fingerprint } from './model.js';

const [command, file = '.local-data/transfer/dropthing.json'] = process.argv.slice(2);
const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};
const validate = (data: TransferEnvelope) => {
  if (data.version !== 1 || data.source !== 'postgres' || !Array.isArray(data.rows))
    fail('Invalid transfer envelope');
  const ids = new Set<string>();
  for (const row of data.rows) {
    if (ids.has(row.id)) fail('Duplicate UUID detected');
    ids.add(row.id);
    if (!['file', 'text', 'link'].includes(row.type)) fail('Invalid drop type');
    if (!Number.isSafeInteger(row.size ?? 0)) fail('Unsafe integer size');
    if (!Number.isFinite(Date.parse(row.createdAt)) || !Number.isFinite(Date.parse(row.expiresAt)))
      fail('Invalid date');
  }
};
const report = async (data: TransferEnvelope) => {
  validate(data);
  const byType = Object.fromEntries(
    ['file', 'text', 'link'].map((type) => [type, data.rows.filter((r) => r.type === type).length])
  );
  console.log(
    JSON.stringify({
      rows: data.rows.length,
      uniqueIds: new Set(data.rows.map((r) => r.id)).size,
      encrypted: data.rows.filter((r) => r.encrypted).length,
      withStorageKey: data.rows.filter((r) => r.storageKey !== null).length,
      nullContent: data.rows.filter((r) => r.content === null).length,
      byType,
      fingerprint: await fingerprint(data.rows),
    })
  );
};
const extract = async () => {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  if (!sourceUrl) fail('SOURCE_DATABASE_URL is required (it is never printed)');
  const client = new Client({ connectionString: sourceUrl });
  await client.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result = await client.query<TransferDrop>(
      `SELECT id::text, type, content, "fileName", "mimeType", "size"::float8 AS size, "storageKey", metadata, encrypted, to_char("createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt", to_char("expiresAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "expiresAt" FROM drops ORDER BY id`
    );
    const data: TransferEnvelope = {
      version: 1,
      extractedAt: new Date().toISOString(),
      source: 'postgres',
      rows: result.rows,
    };
    validate(data);
    await mkdir(dirname(resolve(file)), { recursive: true });
    await writeFile(file, JSON.stringify(data), { mode: 0o600 });
    await client.query('COMMIT');
    await report(data);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
};
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const sqlValue = (value: unknown): string =>
  value === null
    ? 'NULL'
    : typeof value === 'number'
      ? String(value)
      : typeof value === 'boolean'
        ? value
          ? '1'
          : '0'
        : quote(typeof value === 'string' ? value : JSON.stringify(value));
const utf8Chunks = (value: string, maximumBytes = 60_000): string[] => {
  const chunks: string[] = [];
  let chunk = '';
  let bytes = 0;
  for (const character of value) {
    const size = new TextEncoder().encode(character).byteLength;
    if (bytes + size > maximumBytes && chunk) {
      chunks.push(chunk);
      chunk = '';
      bytes = 0;
    }
    chunk += character;
    bytes += size;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
};
const flag = (name: string): string | undefined => {
  const position = process.argv.indexOf(name);
  return position >= 0 ? process.argv[position + 1] : undefined;
};
const importTarget = async () => {
  const remote = process.argv.includes('--remote');
  const databaseName = remote ? flag('--database-name') : 'dropthing-local';
  const databaseId = remote ? flag('--database-id') : undefined;
  const config = remote ? flag('--config') : 'wrangler.jsonc';
  if (!databaseName || !config || (remote && !databaseId))
    fail('Remote import requires --database-name, --database-id and --config');
  if (remote) {
    const info = Bun.spawnSync(['bunx', 'wrangler', 'd1', 'info', databaseName, '--json']);
    if (!info.success) fail('Unable to verify the remote D1 target');
    const parsed = JSON.parse(info.stdout.toString()) as { uuid?: string };
    if (parsed.uuid !== databaseId) fail('Remote D1 name/UUID mismatch');
  }
  const data = JSON.parse(await readFile(file, 'utf8')) as TransferEnvelope;
  validate(data);
  const check = Bun.spawnSync([
    'bunx',
    'wrangler',
    'd1',
    'execute',
    databaseName,
    '--config',
    config,
    remote ? '--remote' : '--local',
    '--command',
    'SELECT count(*) AS count FROM drops',
  ]);
  const output = check.stdout.toString();
  if (!check.success || !output.includes('"count": 0'))
    fail('Target check failed or D1 target is not empty');
  const temp = `/tmp/dropthing-import-${randomUUID()}.sql`;
  const columns = [
    'id',
    'type',
    'content',
    'file_name',
    'mime_type',
    'size',
    'storage_key',
    'metadata',
    'encrypted',
    'created_at',
    'expires_at',
  ];
  const statements = data.rows.flatMap((r) => {
    const contentChunks = r.content === null ? [] : utf8Chunks(r.content);
    const insert = `INSERT INTO drops (${columns.join(',')}) VALUES (${[r.id, r.type, r.content === null ? null : '', r.fileName, r.mimeType, r.size, r.storageKey, r.metadata, r.encrypted, Date.parse(r.createdAt), Date.parse(r.expiresAt)].map(sqlValue).join(',')});`;
    return [
      insert,
      ...contentChunks.map(
        (chunk) =>
          `UPDATE drops SET content = content || ${sqlValue(chunk)} WHERE id = ${sqlValue(r.id)};`
      ),
    ];
  });
  await writeFile(temp, statements.join('\n'), { mode: 0o600 });
  try {
    const run = Bun.spawnSync([
      'bunx',
      'wrangler',
      'd1',
      'execute',
      databaseName,
      '--config',
      config,
      remote ? '--remote' : '--local',
      '--file',
      temp,
    ]);
    if (!run.success) {
      const diagnostic = run.stderr
        .toString()
        .replaceAll(/'([^']|'')*'/g, "'[redacted]'")
        .replaceAll(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[uuid]')
        .slice(0, 1000);
      fail(
        `D1 import failed (exit ${run.exitCode}): ${diagnostic || 'no stderr'} Target may be partially populated; inspect it before retrying.`
      );
    }
  } finally {
    await unlink(temp).catch(() => undefined);
  }
  await report(data);
};
if (command === 'extract') await extract();
else if (command === 'analyze') await report(JSON.parse(await readFile(file, 'utf8')));
else if (command === 'import') await importTarget();
else fail('Usage: bun run transfer -- extract|analyze|import [export-file]');
