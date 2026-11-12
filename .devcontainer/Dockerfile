# SPDX-License-Identifier: FSL-1.1-MIT

# Dev container image for safe-client-gateway.
# Production image is unchanged and lives at the repo-root Dockerfile.
# Microsoft only publishes major-version tags for this image, so we pin by
# digest to keep dev environments reproducible. Production currently uses
# Node 26.12.1 and this digest ships 26.10.0; refresh the digest periodically
# (or via Renovate/Dependabot) to pick up the latest 26.x patch.
FROM mcr.microsoft.com/devcontainers/typescript-node:26-bookworm@sha256:db4af254765190d75d2510a8f11637747cc294c78c6f3f2528fac9b380d8252a

# Microsoft's image runs as the `node` user by default; switch to root
# for system installs and to enable Corepack.
USER root

# Install postgres-client for inspecting db / db-test from inside the container.
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Node >= 25 dropped bundled Corepack; install the version pinned in package.json.
# Remove the base image's global pnpm first: its bins collide with Corepack's shims.
COPY package.json /tmp/corepack-pin/package.json
RUN npm uninstall --global pnpm \
    && npm install --global "corepack@$(node -p 'require("/tmp/corepack-pin/package.json").devDependencies.corepack')" \
    && corepack enable \
    && rm -rf /tmp/corepack-pin

USER node
