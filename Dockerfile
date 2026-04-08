#
# BUILD CONTAINER
#
FROM oven/bun:1.3.11-alpine AS base
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=bun:bun package.json bun.lock tsconfig*.json ./
COPY --chown=bun:bun scripts/generate-abis.js ./scripts/generate-abis.js
COPY --chown=bun:bun assets ./assets
COPY --chown=bun:bun migrations ./migrations
COPY --chown=bun:bun src ./src
RUN bun install --frozen-lockfile \
     && bun run build \
     && rm -rf ./node_modules \
     && bun install --frozen-lockfile --production

#
# PRODUCTION CONTAINER
#
FROM oven/bun:1.3.11-alpine AS production
USER bun

ARG VERSION
ARG BUILD_NUMBER

ENV APPLICATION_VERSION=${VERSION} \
    APPLICATION_BUILD_NUMBER=${BUILD_NUMBER} \
    NODE_ENV=production

COPY --chown=bun:bun --from=base /app/tsconfig*.json ./
COPY --chown=bun:bun --from=base /app/abis ./abis
COPY --chown=bun:bun --from=base /app/node_modules ./node_modules
COPY --chown=bun:bun --from=base /app/dist ./dist
COPY --chown=bun:bun --from=base /app/assets ./assets
COPY --chown=bun:bun --from=base /app/migrations ./migrations
CMD [ "bun", "dist/src/main.js" ]
