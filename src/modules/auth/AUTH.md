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
  │                                │ exchange code for token ────►│
  │                                │◄──── Auth0 JWT ──────────────┤
  │                                │ verify JWT signature + claims│
  │                                │ resolve/create user by sub   │
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

### `redirect_url` query parameter

`/v1/auth/oidc/authorize` accepts an optional `redirect_url` query parameter. It is validated to be same-origin with `AUTH_POST_LOGIN_REDIRECT_URI`, then embedded in the state blob so it can be recovered after the Auth0 round-trip.

### CSRF protection

The `state` parameter passed through Auth0 is a base64url-encoded JSON blob:

```json
{ "csrf": "<64-char hex>", "redirectUrl": "https://..." }
```

It is stored in a short-lived HTTP-only cookie (`auth_state`, 5 min TTL). On callback, the gateway compares the full state string from the query param against the cookie value before proceeding. The state cookie is always cleared at the start of the callback handler, regardless of outcome.

### Callback error handling

The callback **never returns an HTTP error response**. All failures redirect the browser back to the app with an `?error=<code>` query parameter:

| Scenario                                  | `error` value                          |
| ----------------------------------------- | -------------------------------------- |
| Auth0 reports an error (e.g. user denied) | forwarded as-is (e.g. `access_denied`) |
| Missing `code` or `state` in callback     | `invalid_request`                      |
| State cookie mismatch                     | `invalid_request`                      |
| Code exchange or JWT verification failed  | `authentication_failed`                |

The redirect target is resolved from the state cookie's `redirectUrl` when available, or falls back to `AUTH_POST_LOGIN_REDIRECT_URI`.

---

## Auth0 Configuration

| Env var                | Description                                  |
| ---------------------- | -------------------------------------------- |
| `AUTH0_DOMAIN`         | Auth0 tenant domain, e.g. `tenant.auth0.com` |
| `AUTH0_CLIENT_ID`      | Application client ID                        |
| `AUTH0_CLIENT_SECRET`  | Application client secret                    |
| `AUTH0_REDIRECT_URI`   | Callback URL (must be allowlisted in Auth0)  |
| `AUTH0_API_AUDIENCE`   | API identifier (audience claim in tokens)    |
| `AUTH0_SIGNING_SECRET` | HS256 secret for verifying Auth0 JWTs        |
| `AUTH0_SCOPE`          | Requested scopes, defaults to `openid`       |

Auth0 tokens are verified using **HS256** (HMAC-SHA256). The verifier checks issuer (`https://{domain}/`), audience, and signature before extracting claims. The Auth0 `sub` (external user ID) is then mapped to an internal numeric user ID via `usersRepository.findOrCreateByExtUserId()`.

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

## MCP endpoint

`POST /v1/mcp` lets an MCP client, such as a Claude custom connector, call the gateway as an Auth0-authenticated user. Gated by `FF_MCP`, which requires `FF_OIDC_AUTH`.

| Env var            | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `FF_MCP`           | Enables `/v1/mcp` and its protected resource metadata                        |
| `MCP_RESOURCE_URL` | Public URL of `/v1/mcp`; the audience of the access tokens it accepts         |

```
MCP client                       Gateway                          Auth0
  │                                │                                │
  ├─ POST /v1/mcp ────────────────►│ 401 + WWW-Authenticate         │
  ├─ GET /.well-known/oauth-protected-resource/v1/mcp ─►│ names Auth0 as authorization server
  ├─ OAuth (authorization code + PKCE, resource=MCP_RESOURCE_URL) ─►│
  │◄──────────────────────────────── access token (aud = MCP URL) ─┤
  ├─ POST /v1/mcp (Bearer) ───────►│ McpAuthGuard: verify via JWKS, │
  │                                │ map `sub` to the internal user │
```

- **Tools** come from the gateway's own OpenAPI document (`/api-json`): `search_endpoints`, `describe_endpoint`, `read_endpoint` (GET) and `write_endpoint` (POST/PUT/PATCH/DELETE). Only documented paths can be called; the MCP controllers are excluded from the document.
- **Each call** is replayed in-process (`fastify.inject`) with a 60-second internal JWT as the `access_token` cookie, so it passes the same guards, pipes, rate limits and `ElevationGuard` as a web request.
- **Users** must have signed in to the web app once; the access token carries no email, so no account is created here.

### Step-up from an MCP client

The second factor comes from the access token's `https://safe.global/mfa_verified_at` claim, set by a post-login Action. When a call is refused with `elevation_required`, the tool result carries a link instead of an error alone:

1. The gateway stores a step-up request (`userId`, the token's `azp`) under a random id, for `AUTH_STATE_TTL_MILLISECONDS`.
2. The link is `/v1/auth/oidc/authorize?mcp_elevation=<id>`, on the host of `AUTH0_REDIRECT_URI` so the state cookie returns with the callback. It implies `elevate`.
3. The callback consumes the request once, requires `amr` to contain `mfa`, and requires the ID token's user to be the one the request was opened for. It records the step-up for that user and client for `AUTH_ELEVATION_WINDOW_SECONDS`, sets no session cookie, and answers with a plain-text page.
4. On the retried call, the internal JWT's `mfa_verified_at` is the later of the token claim and the recorded step-up.

A token without `azp` cannot be tied to one connection; its user is told to reconnect instead.

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
- SiWe message time bounds (`issuedAt`, `expirationTime`, `notBefore`) are validated with a tolerated clock skew between client and server (`AUTH_CLOCK_SKEW_SECONDS`, default `30`) to avoid rejecting valid messages when clocks are slightly out of sync
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

| Env var                          | Default  | Description                                             |
| -------------------------------- | -------- | ------------------------------------------------------- |
| `AUTH_NONCE_TTL_SECONDS`         | `300`    | How long a SiWe nonce is valid                          |
| `AUTH_VALIDITY_PERIOD_SECONDS`   | `86400`  | Max token lifetime                                      |
| `AUTH_CLOCK_SKEW_SECONDS`        | `30`     | Tolerated client/server clock skew for SiWe time bounds |
| `AUTH_STATE_TTL_MILLISECONDS`    | `300000` | OIDC state cookie TTL                                   |
| `AUTH_POST_LOGIN_REDIRECT_URI`   | —        | Required. Default redirect after login                  |
| `AUTH_ALLOWED_REDIRECT_DOMAIN`   | —        | Optional. Extra allowed redirect domain (non-prod)      |
| `AUTH_RATE_LIMIT_MAX`            | `5`      | OIDC requests per window                                |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS` | `60`     | Rate limit window                                       |

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
