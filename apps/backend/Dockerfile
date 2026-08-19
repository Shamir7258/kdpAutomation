# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/document-engine/package.json packages/document-engine/package.json
COPY packages/cover-engine/package.json packages/cover-engine/package.json
COPY packages/kdp-validator/package.json packages/kdp-validator/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build -w @kdp/backend

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules ./node_modules
# npm doesn't always hoist every dependency to the root node_modules (version/resolution
# quirks) — anything it nests under apps/backend/node_modules instead would otherwise be
# invisible here, since only the root node_modules is copied above. Node's own resolution
# walks up from dist/server.js through apps/backend/node_modules before reaching the root,
# so this covers it without needing to know in advance which packages get nested.
COPY --from=deps /repo/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /repo/apps/backend/dist ./apps/backend/dist
COPY --from=build /repo/apps/backend/package.json ./apps/backend/package.json
EXPOSE 4000
CMD ["node", "apps/backend/dist/server.js"]
