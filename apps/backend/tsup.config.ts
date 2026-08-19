import { defineConfig } from 'tsup';

export default defineConfig({
  // Bundled as separate entry points (not run via tsx) so they're runnable against a deployed
  // container with plain `node` — the runtime image has no src/ or tsx, only dist/ and node_modules.
  entry: ['src/server.ts', 'src/scripts/sync-indexes.ts', 'src/scripts/seed-admin.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  sourcemap: true,
  outDir: 'dist',
  // Workspace packages (@kdp/*) are TypeScript source with no build step of their own — meant to
  // be consumed via tsx (dev) or bundled by whatever consumes them. Left external (tsup's
  // default for anything resolved through node_modules, which workspace symlinks are), the
  // production container tries to `import` their raw .ts files with plain Node and fails
  // immediately (ERR_UNKNOWN_FILE_EXTENSION) — there's no tsx/ts-node loader in the runtime
  // image. Force them to be inlined into dist/server.js instead.
  noExternal: [/^@kdp\//],
  // tsup's default externalization only looks at apps/backend/package.json's own
  // `dependencies` — packages only required transitively through the now-inlined @kdp/*
  // source (sharp, the AWS SDK, pdfkit, etc.) aren't in that list, so without this they'd get
  // swept into the bundle too. That's at best wasteful and at worst broken: sharp is backed by
  // a native .node addon that esbuild cannot bundle correctly. Keep every such transitive
  // third-party dependency external explicitly; npm workspaces hoist them into the shared root
  // node_modules, which the runtime image copies in full, so plain `node` resolves them fine.
  external: [
    'sharp',
    'pdfkit',
    'docx',
    'epub-gen-memory',
    'markdown-it',
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
    '@anthropic-ai/sdk',
    'openai',
    'zod-to-json-schema',
  ],
});
