import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  }),
);

app.get("/health", (c) => {
  return c.json({ status: "ok", service: "dropthing-api" });
});

// TODO: POST /upload — UploadService
// TODO: GET  /share/:id — téléchargement du fichier
// TODO: GET  /share/:id/meta — métadonnées du share

export default {
  port: 3000,
  fetch: app.fetch,
};
