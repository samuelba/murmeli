# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f backend/Dockerfile .
ARG NODE_IMAGE=node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5

FROM ${NODE_IMAGE} AS content
WORKDIR /app/content
COPY content/package.json content/package-lock.json ./
RUN npm ci --ignore-scripts
COPY content/tsconfig.json content/tsconfig.build.json ./
COPY content/schema ./schema
RUN npm run build && npm prune --omit=dev --ignore-scripts
COPY content/tracks ./tracks
COPY content/lexicon ./lexicon
COPY content/pictures ./pictures
COPY content/pictures.yaml ./

FROM ${NODE_IMAGE} AS deps
WORKDIR /app/backend
COPY --from=content /app/content /app/content
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --ignore-scripts

FROM deps AS development
ENV NODE_ENV=development
COPY backend/ ./
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM deps AS build
COPY backend/ ./
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM ${NODE_IMAGE} AS production
ENV NODE_ENV=production \
    BACKUP_DIR=/app/backups
WORKDIR /app/backend
RUN apk add --no-cache postgresql18-client \
    && mkdir -p /app/backups \
    && chown node:node /app/backups \
    && chmod 700 /app/backups \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
       /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --from=content /app/content/package.json /app/content/
COPY --from=content /app/content/node_modules /app/content/node_modules
COPY --from=content /app/content/dist /app/content/dist
COPY --from=content /app/content/tracks /app/content/tracks
COPY --from=content /app/content/lexicon /app/content/lexicon
COPY --from=content /app/content/pictures /app/content/pictures
COPY --from=content /app/content/pictures.yaml /app/content/
COPY --from=build /app/backend/package.json ./
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --chmod=755 backend/docker-entrypoint.sh ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
ENTRYPOINT ["./docker-entrypoint.sh"]
