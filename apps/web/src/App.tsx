import { useEffect, useState } from "react";
import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";

const healthCheck = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client.get("/api/health");
  return yield* response.json;
}).pipe(Effect.provide(FetchHttpClient.layer));

export function App() {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    Effect.runPromise(healthCheck)
      .then((data: any) => setStatus(data.status))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-50">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">dropthing</h1>
        <p className="text-neutral-400">drop and share your files</p>
        <div className="text-sm text-neutral-500">
          API:{" "}
          {status === null ? (
            <span className="text-neutral-500">...</span>
          ) : status === "ok" ? (
            <span className="text-green-500">connected</span>
          ) : (
            <span className="text-red-500">error</span>
          )}
        </div>
      </div>
    </div>
  );
}
