# Repository Guidelines

## Project Structure & Module Organization
- `worker/`: Cloudflare Worker entrypoint (`src/index.ts`, auth helpers, rate limiting) and deployment config via `wrangler.toml`. Treat it as the only public-facing surface.
- `bridge/`: Local Express bridge (`src/server.ts`, Day One CLI wrapper) released as an npm module and compiled to `dist/` via TypeScript.
- `shared/`: Cross-project TypeScript contracts (`types.ts`) consumed by both worker and bridge to keep request/response models aligned.
- `scripts/`: Operational helpers (`setup-bridge.sh`, `deploy-worker.sh`, `generate-tokens.sh`) meant to be run from the repo root. Keep script output idempotent.
- `docs/` + `README.md`: Narrative documentation; update alongside code-facing changes.

## Build, Test & Development Commands
- `npm run dev:worker`: Starts Wrangler local worker with live reload; expects Cloudflare env vars exported.
- `npm run dev:bridge`: Launches the bridge with `tsx watch` and reloads on TypeScript changes.
- `npm run build`: Compiles all workspaces (`bridge` → `dist/`, `worker` → type-check).
- `npm run deploy:worker`: Deploys the worker via Wrangler; ensure `wrangler login` already succeeded.
- `npm run test`: Placeholder aggregation; add package-level tests before wiring them in.
- Manual smoke: `curl http://localhost:3000/health` once `npm run dev:bridge` is up to confirm Day One CLI connectivity.

## Coding Style & Naming Conventions
- TypeScript-first, ECMAScript modules, strict null checks. Maintain two-space indentation and trailing commas in multi-line literals.
- Export classes/functions with descriptive names (`MCPHandler`, `DayOneClient`); file names use kebab-case within `src/`.
- Prefer async/await over raw promises; surface errors with meaningful messages and structured JSON payloads mirroring MCP error schema.
- Run `tsc --noEmit` in each workspace before submitting significant patches.

## Testing Guidelines
- Testing is currently manual; when adding automated coverage, colocate tests under `src/__tests__/` and register via each workspace’s `package.json`.
- Use lightweight HTTP mocks (e.g., `msw` or `nock`) for bridge tests and snapshot the worker’s JSON-RPC responses.
- Document manual validation steps in PR descriptions until automated coverage lands.

## Commit & Pull Request Guidelines
- Follow the existing history: short, imperative subject lines (`Fix rate limiting edge case`), capitalize the first word, max ~60 chars. Group related file changes per commit.
- Every PR should include: purpose summary, notable config/env updates, local verification snippet (`npm run dev:worker` / `npm run dev:bridge`), and any security implications. Link Day One task IDs or GitHub issues when available.
- Request review from both worker and bridge owners when touching shared types.

## Security & Configuration Tips
- Store sensitive values in Wrangler secrets (`wrangler secret put`) and `.env` for the bridge; never commit credentials.
- Keep `AUTH_TOKEN` and `MCP_API_KEYS` rotated; when adding new env vars, document them in `docs/configuration.md` and update the setup script defaults.
- Validate Day One CLI access paths (`DAYONE_CLI_PATH`) during PR smoke tests, especially on macOS vs. Linux runners.
