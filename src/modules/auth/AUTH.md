<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Authentication Module

This module implements two authentication strategies that can be enabled independently via feature flags:

- **SiWe** (Sign-In with Ethereum) — wallet-based auth
- **OIDC/Auth0** — OAuth 2.0 authorization code flow via Auth0

Both strategies produce a signed internal JWT stored in an HTTP-only cookie. The rest of the application verifies that cookie uniformly via `AuthGuard`, regardless of how the user authenticated.

---

## Feature Flags

| Flag        | Env var             | Effect                       |
| ----------- | ------------------- | ---------------------------- |
| `auth`      | `FF_AUTH=true`      | Enables SiWe endpoints       |
| `oidc_auth` | `FF_OIDC_AUTH=true` | Enables OIDC/Auth0 endpoints |

Both can be enabled simultaneously.

---

## SiWe Flow

```
Client                          Gateway
  │                                │
  ├─ GET /v1/auth/nonce ──────────►│ generates nonce, stores in cache
  │◄──────────────────── { nonce } ─┤
  │                                │
  │  (user signs EIP-4361 message) │
  │                                │
  ├─ POST /v1/auth/verify ────────►│ validates signature + nonce
  │  { message, signature }        │ resolves/creates user by wallet address
  │                                │ signs internal JWT (SiweAuthPayload)
  │◄───── Set-Cookie: access_token ─┤
  │                                │
  ├─ GET /v1/auth/me ─────────────►│ AuthGuard verifies cookie JWT
  │◄─── { id, authMethod, signerAddress } ─┤
  │                                │
  ├─ POST /v1/auth/logout ────────►│ clears access_token cookie
```

### JWT payload (SiWe)

```json
{
  "sub": "42",
  "auth_method": "siwe",
  "chain_id": "1",
  "signer_address": "0xabc..."
}
```

---

## OIDC/Auth0 Flow

```
Client                          Gateway                        Auth0
  │                                │                              │
  ├─ GET /v1/auth/oidc/authorize ─►│ generate CSRF token          │
  │                                │ encode state cookie          │
  │                                │ build authorize URL ────────►│
  │◄──── 302 redirect to Auth0 ────┤                              │
  │                                │                              │
  │  (user authenticates at Auth0) │                              │
  │                                │                              │
  │◄──── 302 redirect to callback ─┼──────────────────────────────┤
  │                                │   ?code=...&state=...        │
  ├─ GET /v1/auth/oidc/callback ──►│ validate state vs cookie     │
  │                                │ clear state cookie           │
  │                                │ exchange code for id_token ─►│
  │                                │◄──── Auth0 id_token ─────────┤
  │                                │ verify id_token + claims     │
  │                                │ resolve/create user by sub   │
  │                                │ persist verified email       │
  │                                │ sign internal JWT (OidcAuthPayload)
  │◄──── Set-Cookie: access_token ─┤                              │
  │◄──── 302 redirect to app ──────┤                              │
```

### JWT payload (OIDC)

```json
{
  "sub": "7",
  "auth_method": "oidc"
}
```

The Auth0 `sub` (external user ID) is mapped to the internal user ID at login. Subsequent requests only carry the internal ID.

### Email claims

CGW reads email claims from the verified Auth0 `id_token`; it does **not** use the Auth0 access token for identity claims and does **not** call the Auth0 Management API on the auth path.

Only verified emails are persisted or checked for uniqueness. If the `id_token` contains `email_verified: true` and a valid `email`, CGW stores the normalized email on `users.email`. The value is write-once: existing user emails are not overwritten.

If the verified email already belongs to another CGW user, authentication fails with `409 Conflict` and `code: "user_email_already_in_use"`. Two user accounts must not share the same email. This should usually be prevented by Auth0 account-conflict handling before CGW sees it.

Invite-claim flows that intentionally attach a pending invited member to a first-time OIDC user must resolve that ownership before persisting the email.

The internal CGW JWT does not contain the email. `GET /v1/auth/me` returns the stored email for OIDC users by reading `users.email`; SiWe sessions do not include an email.

### `redirect_url` query parameter

`/v1/auth/oidc/authorize` accepts an optional `redirect_url` query parameter. It is validated to be same-origin with `AUTH_POST_LOGIN_REDIRECT_URI`, then embedded in the state blob so it can be recovered after the Auth0 round-trip.

### CSRF protection

The `state` parameter passed through Auth0 is a base64url-encoded JSON blob:

```json
{ "csrf": "<64-char hex>", "redirectUrl": "https://..." }
```

It is stored in a short-lived HTTP-only cookie (`auth_state`, 5 min TTL). On callback, the gateway compares the full state string from the query param against the cookie value before proceeding. The state cookie is always cleared at the start of the callback handler, regardless of outcome.

### Callback error handling

Most callback failures redirect the browser back to the app with an `?error=<code>` query parameter:

| Scenario                                  | `error` value                          |
| ----------------------------------------- | -------------------------------------- |
| Auth0 reports an error (e.g. user denied) | forwarded as-is (e.g. `access_denied`) |
| Missing `code` or `state` in callback     | `invalid_request`                      |
| State cookie mismatch                     | `invalid_request`                      |
| Code exchange or JWT verification failed  | `authentication_failed`                |

If Auth0 returns a verified email that already belongs to another CGW user, the callback returns `409 Conflict` with `code: "user_email_already_in_use"` instead of redirecting. This is a CGW account-identity conflict, not an Auth0/provider failure.

The redirect target is resolved from the state cookie's `redirectUrl` when available, or falls back to `AUTH_POST_LOGIN_REDIRECT_URI`.

---

## Auth0 Configuration

| Env var               | Description                                  |
| --------------------- | -------------------------------------------- |
| `AUTH0_DOMAIN`        | Auth0 tenant domain, e.g. `tenant.auth0.com` |
| `AUTH0_CLIENT_ID`     | Application client ID                        |
| `AUTH0_CLIENT_SECRET` | Application client secret                    |
| `AUTH0_REDIRECT_URI`  | Callback URL (must be allowlisted in Auth0)  |
| `AUTH0_API_AUDIENCE`  | API audience sent on the Auth0 authorize URL |
| `AUTH0_SCOPE`         | Requested scopes, defaults to `openid`       |

Set `AUTH0_SCOPE` to include `email` in environments where CGW should receive email claims, for example `openid email`. `profile` is not required for this flow.

CGW verifies the Auth0 `id_token` using **RS256** and Auth0's JWKS (`/.well-known/jwks.json`) via `jose`'s remote JWKS verifier. The verifier checks issuer (`https://{domain}/`), audience (`AUTH0_CLIENT_ID`), and signature before extracting claims. The Auth0 `sub` (external user ID) is then mapped to an internal numeric user ID via `usersRepository.findOrCreateByExtUserId()`.

> **Auth0 dashboard requirements:** Both redirect URLs must be allowlisted in the Auth0 application settings:
>
> - `AUTH0_REDIRECT_URI` (the callback URL) must be added to **Allowed Callback URLs**
> - The post-login redirect target (`AUTH_POST_LOGIN_REDIRECT_URI`) must be added to **Allowed Logout URLs**
>
> Requests using URLs not on these lists will be rejected by Auth0.

---

## Auth0 Connection Types

The authorize URL accepts an optional `connection` parameter to pre-select the identity provider:

- `email` — passwordless email link
- `google-oauth2` — Google social login

If omitted, Auth0 shows its default login page.

---

## Cookies

| Cookie         | Content                       | Flags                                       |
| -------------- | ----------------------------- | ------------------------------------------- |
| `access_token` | Signed internal JWT           | `HttpOnly`, `Secure`, `SameSite=Lax` (prod) |
| `auth_state`   | CSRF state (OIDC only, 5 min) | `HttpOnly`, `Secure`, `SameSite=Lax` (prod) |

In non-production environments `SameSite` is set to `none` to support cross-origin development setups.

---

## Guards and Decorators

### `AuthGuard`

Extracts and verifies the `access_token` cookie. Adds the decoded `AuthPayload` to the request. Use for endpoints that require authentication.

```typescript
@UseGuards(AuthGuard)
@Get('me')
getMe(@Auth() authPayload: AuthPayload) { ... }
```

### `OptionalAuthGuard`

Same as `AuthGuard` but allows unauthenticated requests through. The payload will be empty if no valid token is present.

### `OidcAuthRateLimitGuard`

Applied at the **controller level** on `OidcAuthController`, so it covers both `/oidc/authorize` and `/oidc/callback`. Configured via `AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW_SECONDS`.

### `@Auth()` decorator

Parameter decorator that extracts the `AuthPayload` from the request object.

---

## `AuthPayload`

A single class representing the decoded JWT for either strategy:

```typescript
class AuthPayload {
  sub?: string; // internal user ID
  auth_method?: 'siwe' | 'oidc';
  chain_id?: string; // SiWe only
  signer_address?: Address; // SiWe only

  isAuthenticated(): boolean;
  isSiwe(): boolean; // type-narrows to SiweAuthPayload
  isOidc(): boolean; // type-narrows to OidcAuthPayload
  isForChain(chainId): boolean;
  isForSigner(address): boolean; // case-insensitive — handles checksummed vs non-checksummed
  getUserId(): string | undefined;
}
```

Use `assertAuthenticated(payload)` from `utils/assert-authenticated.utils.ts` to narrow the type and throw a `ForbiddenException` if the user is not authenticated.

---

## Logout

| Endpoint                        | Behaviour                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/auth/logout`          | Clears `access_token` cookie, returns 200                                                                                                    |
| `POST /v1/auth/logout/redirect` | Clears cookie; if Auth0 configured, redirects through `https://{domain}/v2/logout?returnTo=...`; otherwise redirects to provided/default URL |

---

## Token Validity

- Default max lifetime: **24 hours** (`AUTH_VALIDITY_PERIOD_SECONDS`, default `86400`)
- SiWe messages may include `expirationTime`; gateway enforces whichever is shorter
- SiWe messages may include `notBefore`; if present, the JWT `nbf` claim is set and the token is not valid before that time
- Auth0 tokens inherit their `exp` from Auth0; the cookie `maxAge` is derived from the JWT `exp` claim
- Logout redirect checks `auth_method` from the current token (without re-verifying it) to decide whether to route through Auth0's logout endpoint

---

## Redirect Validation

Post-login redirects are validated against `AUTH_POST_LOGIN_REDIRECT_URI`:

- Production: redirect must share the same origin
- Non-production: also allows subdomains of `AUTH_ALLOWED_REDIRECT_DOMAIN`
- Always rejected: non-HTTPS URLs, URLs with credentials, URLs with explicit ports

---

## Other Auth Config

| Env var                          | Default  | Description                                        |
| -------------------------------- | -------- | -------------------------------------------------- |
| `AUTH_NONCE_TTL_SECONDS`         | `300`    | How long a SiWe nonce is valid                     |
| `AUTH_VALIDITY_PERIOD_SECONDS`   | `86400`  | Max token lifetime                                 |
| `AUTH_STATE_TTL_MILLISECONDS`    | `300000` | OIDC state cookie TTL                              |
| `AUTH_POST_LOGIN_REDIRECT_URI`   | —        | Required. Default redirect after login             |
| `AUTH_ALLOWED_REDIRECT_DOMAIN`   | —        | Optional. Extra allowed redirect domain (non-prod) |
| `AUTH_RATE_LIMIT_MAX`            | `5`      | OIDC requests per window                           |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS` | `60`     | Rate limit window                                  |

---

## Module Structure

```
auth/
├── auth.module.ts                  # SiWe module
├── domain/
│   ├── auth.repository.ts          # JWT sign/verify (shared by both flows)
│   └── entities/auth-payload.entity.ts
├── oidc/
│   ├── oidc-auth.module.ts         # OIDC module
│   ├── auth0/                      # Auth0 data source + token verifier
│   └── routes/                     # OIDC controller, service, guards
├── routes/                         # SiWe controller, service, guards, decorators
└── utils/                          # Cookie config, token expiry, redirect validation
```

`AuthRepositoryModule` is a shared module imported by both `AuthModule` and `OidcAuthModule`, exposing the JWT repository to each.
