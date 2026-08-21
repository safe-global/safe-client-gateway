// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Name of the request property that carries the verified session payload.
 *
 * Shared rather than owned by `AuthGuard` so that a guard outside the auth
 * module can read what `AuthGuard` attached without importing that module's
 * `routes/` tree — see the cross-module import rule in
 * `docs/agents/module-structure.md`.
 */
export const AUTH_PAYLOAD_REQUEST_PROPERTY = 'accessToken';
