# SPDX-License-Identifier: FSL-1.1-MIT
#
# INSTALL CONTAINER
#
FROM oven/bun:1.4.2-alpine AS base
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=bun:bun package.json bun.lock bunfig.toml tsconfig.json ./
# Run by the postinstall script to generate the ABIs under ./abis.
COPY --chown=bun:bun scripts/generate-abis.ts ./scripts/generate-abis.ts
# `--frozen-lockfile` fails on any drift from bun.lock and every tarball is
# checked against its recorded integrity hash; dependency lifecycle scripts
# never run (`trustedDependencies: []`). Only production dependencies.
RUN bun install --frozen-lockfile --production
COPY --chown=bun:bun src ./src
COPY --chown=bun:bun migrations ./migrations
# One-off workloads run from this image, e.g. minting billing webhook tokens
# (see src/modules/billing/README.md): `bun scripts/generate-token.ts`.
COPY --chown=bun:bun scripts/generate-token.ts scripts/generate-field-encryption-index-key.ts scripts/backfill-field-encryption.ts ./scripts/
# Specs and their helpers are not shipped: nothing outside them imports them.
RUN find src migrations -type d -name __tests__ -prune -exec rm -rf {} + \
     && find src -type f -name '*.spec.ts' -delete

#
# PRODUCTION CONTAINER
#
FROM oven/bun:1.4.2-alpine AS production
USER bun
WORKDIR /app

ARG VERSION
ARG BUILD_NUMBER

ENV APPLICATION_VERSION=${VERSION} \
    APPLICATION_BUILD_NUMBER=${BUILD_NUMBER} \
    NODE_ENV=production

# Bun runs the TypeScript sources directly; tsconfig.json supplies the `#/`
# path aliases at runtime.
COPY --chown=bun:bun --from=base /app/package.json /app/bunfig.toml /app/tsconfig.json ./
COPY --chown=bun:bun --from=base /app/node_modules ./node_modules
COPY --chown=bun:bun --from=base /app/abis ./abis
COPY --chown=bun:bun --from=base /app/src ./src
COPY --chown=bun:bun --from=base /app/migrations ./migrations
COPY --chown=bun:bun --from=base /app/scripts ./scripts
COPY --chown=bun:bun assets ./assets
# `--preload` starts OpenTelemetry before the app is imported, so the
# instrumented libraries (http, pg, redis, ioredis, amqplib) are patched when
# the app loads them. Traces go to the Datadog Agent's OTLP receiver.
CMD [ "bun", "--preload", "./src/tracing/tracing.ts", "src/main.ts" ]
