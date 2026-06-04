#!/usr/bin/env bash
# SPDX-License-Identifier: FSL-1.1-MIT

# Runs once after the devcontainer is created.
# Keep this idempotent so re-running it is safe.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[devcontainer] Activating Corepack..."
corepack enable

echo "[devcontainer] Installing dependencies..."
yarn install --immutable

echo "[devcontainer] Setup complete."
