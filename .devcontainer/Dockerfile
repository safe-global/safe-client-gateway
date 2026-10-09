# SPDX-License-Identifier: FSL-1.1-MIT

# Dev container image for safe-client-gateway.
# Production image is unchanged and lives at the repo-root Dockerfile.
# Microsoft only publishes moving tags for this image, so we pin by digest to
# keep dev environments reproducible; refresh it periodically.
FROM mcr.microsoft.com/devcontainers/base:bookworm@sha256:3aacff4130e6cf04709f9cab1d7a6d3e1cc4bff6202bc61611831a18d3755673

# Same Bun release as production (Dockerfile, package.json `packageManager`),
# taken from the official image rather than a piped install script.
COPY --from=oven/bun:1.4.2-debian@sha256:4f6e31d1a54d6a3dd312daef655fc998101b5043d52e12592ac293ef04b9bc73 /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx

# Install postgres-client for inspecting db / db-test from inside the container.
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER vscode
