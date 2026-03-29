# dropthing

Ephemeral file sharing service. Bun monorepo with Effect v4, Hono, Drizzle, React.

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

**After writing or modifying Effect code**, always run `effect-solutions show <relevant-topics>` to verify the code respects best practices. This is a mandatory step, not optional.

<!-- effect-solutions:end -->

## Local Effect Source

The Effect source repository is cloned to `~/.local/share/effect-solutions/effect` for reference.
Use this to explore APIs, find usage examples, and understand implementation details when the documentation isn't enough.

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`.
