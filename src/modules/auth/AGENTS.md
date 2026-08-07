<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

Working on authentication? Read [docs/agents/security.md](../../../docs/agents/security.md) first — SIWE nonce
lifecycle, JWT cookie flags, guard placement, and the OIDC flow are all specified there.

Non-negotiables that bite hardest in this module: identity comes from signature recovery or a verified JWT,
never from a client-supplied claim; every state-changing or caller-scoped route declares an auth guard; and
expected rejections use `HttpExceptionNoLog` rather than a logged error. Guards live in `routes/guards/` per the
canonical skeleton ([docs/agents/module-structure.md](../../../docs/agents/module-structure.md)).
