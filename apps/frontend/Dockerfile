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
ARG API_BASE=http://backend:4000
ENV API_BASE=$API_BASE
RUN npm run build -w @kdp/frontend

FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/frontend/dist /usr/share/nginx/html
COPY infrastructure/nginx/frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
