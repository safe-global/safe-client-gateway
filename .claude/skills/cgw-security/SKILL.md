---
name: cgw-security
description: Use when a change in safe-client-gateway touches authentication, authorization, guards, signatures, JWTs, cookies, secrets, env-var declaration, PII, rate limiting, logging of request data, redirects, or upstream URL construction. For a plain non-secret env var or a feature flag, load cgw-config instead - this skill only claims the secret half (keys, tokens, private keys, anything whose leak matters). Covers the 15 hard rules drawn from this repo's real security incidents - guard placement on state-changing and caller-scoped routes, identity only via SIWE signature recovery or a verified JWT, replay protection, request.ip instead of X-Forwarded-For, timingSafeEqual, KMS field encryption, input sanitization, structured-logging field whitelists. Triggers on "auth", "guard", "token", "signature", "secret", "env var", "PII", "encrypt", "rate limit", "who is the caller", and on any request phrased as a permission - "let a user do X to their own Y", "only the owner should be able to", "can this user", "members only", plus any new endpoint that writes, deletes, or returns data belonging to one caller.
---

# CGW Security

Read **[docs/agents/security.md](../../../docs/agents/security.md)** before writing the change. This skill is a loader; the doc is the content.

Stop-and-consult territory: every rule in that doc traces to a real fix in this repo's history (unauthenticated admin endpoints, JWT algorithm confusion, spoofable client-IP headers, ownership-by-claim, replay windows, unbounded token lifetimes). Do not reason from first principles where the doc has a rule.

The two that get missed most:

- **Identity never comes from a client claim.** It comes from SIWE signature recovery or a JWT verified through `IJwtService` with a pinned algorithm and bounded `exp`. A `userId` in a body or query is an input to validate, not an identity.
- **Every state-changing or caller-scoped route declares a guard.** A new handler on a controller whose siblings all begin with an ownership assertion needs the same assertion, or a written justification in the PR body (see cgw-remarks R-024).

Env-var declaration is shared with **cgw-config**: every variable lives in `configuration.ts` *and* `RootConfigurationSchema`, and a secret never gets a fallback default.
