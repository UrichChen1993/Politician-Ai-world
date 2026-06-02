// The Convex default runtime exposes environment variables via `process.env`
// (and only that — not the full Node `process` API). Declare just that surface
// so action code reading LLM_PROVIDER / API keys typechecks under convex/tsconfig
// without pulling in all of @types/node.
declare const process: { env: Record<string, string | undefined> };
