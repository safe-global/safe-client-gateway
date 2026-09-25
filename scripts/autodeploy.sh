#!/bin/bash
# SPDX-License-Identifier: FSL-1.1-MIT
#
# Nudges the legacy deploy controller to pull the moving tag that was just
# pushed, instead of waiting out argocd-image-updater's own poll interval.
# Transitional: retired together with the moving tag at the ArgoCD cutover.

set -euo pipefail

STATUS=$(curl -s --output /dev/null --write-out "%{http_code}" \
    -H "Content-Type: application/json" \
    -X POST \
    -u "$AUTODEPLOY_TOKEN" \
    -d "{\"push_data\": {\"tag\": \"${TARGET_ENV}\"}}" \
    "$AUTODEPLOY_URL")

# `curl -s` without `-f` exits 0 for any HTTP response, so `set -e` never sees a
# 4xx/5xx. The status code was already being captured here and then discarded,
# which made a rejected webhook indistinguishable from an accepted one.
if [ "$STATUS" -lt 200 ] || [ "$STATUS" -ge 300 ]; then
  echo "::error::autodeploy webhook rejected the ${TARGET_ENV} nudge (HTTP ${STATUS})"
  exit 1
fi

echo "autodeploy webhook accepted the ${TARGET_ENV} nudge (HTTP ${STATUS})"
