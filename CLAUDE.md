# dropthing

Ephemeral file sharing service. Bun monorepo with Effect v3, Hono, Drizzle, React.

## Commands

- `bun run dev` — start all services
- `bun run dev:api` — start API only
- `bun run lint` / `bun run lint:fix` — oxlint
- `bun run format` / `bun run format:check` — oxfmt
- `bun run type-check` — tsc --build --noEmit
- `bun run compose` / `bun run compose:down` — local PostgreSQL

## Project structure

- `apps/api` — Hono + Effect API (port 3001)
- `apps/web` — React + Vite frontend
- `packages/shared` — Effect schemas, errors, constants

<!-- effect-solutions:start -->

## Effect Best Practices

**IMPORTANT:** Always consult effect-solutions before writing Effect code.

1. Run `effect-solutions list` to see available guides
2. Run `effect-solutions show <topic>...` for relevant patterns (supports multiple topics)
3. Search `~/.local/share/effect-solutions/effect` for real implementations

Topics: quick-start, project-setup, tsconfig, basics, services-and-layers, data-modeling, error-handling, config, testing, cli.

Never guess at Effect patterns - check the guide first.

<!-- effect-solutions:end -->

## Local Effect Source

The Effect source repository is cloned to `~/.local/share/effect-solutions/effect` for reference.
Use this to explore APIs, find usage examples, and understand implementation details when the documentation isn't enough.
