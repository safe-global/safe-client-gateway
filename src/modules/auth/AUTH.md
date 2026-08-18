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
  │                                │ POST /oauth/token ──────────►│
  │                                │  code + client_id +          │
  │                                │  client_secret + redirect_uri│
  │                                │◄─ id_token + access_token ───┤
  │                                │ verify id_token vs JWKS      │
  │                                │ (RS256, iss, aud=client_id)  │
  │                                │ require verified email       │
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

### Front channel, not back channel

Auth0 never calls the gateway. `AUTH0_REDIRECT_URI` points at `/v1/auth/oidc/callback` on the gateway rather than at the frontend, but `redirect_uri` in OAuth is always a **front-channel** destination: it is where Auth0 tells the *browser* to navigate. The callback is a top-level browser GET, not a server-to-server request, and not a `fetch` from the frontend either:

| Mechanism                                            | Used? |
| ---------------------------------------------------- | ----- |
| Auth0 → gateway, server to server                    | No    |
| `app.safe.global` JS calling the callback via `fetch` | No    |
| Browser navigation, Auth0 `302` → gateway callback    | Yes   |

The handler proves it: it reads the `auth_state` cookie off the request, writes `Set-Cookie: access_token`, and answers `302` to the app. None of those work unless the caller is the user's browser — Auth0's servers hold no cookie jar for the user, and would discard the `Set-Cookie`. `OidcAuthRateLimitGuard` keying on `req.ip` is the same story: a back-channel design would collapse every user onto Auth0's egress IPs and rate-limit all logins together.

What pointing `redirect_uri` at the gateway *does* buy is that the `code` lands on the server, so it is redeemed server-side with the client secret and no Auth0 token ever reaches JavaScript. The browser only ever receives the gateway's own `access_token` cookie.

The consequence is that **the callback's inputs are entirely attacker-controllable** — anyone can request `/v1/auth/oidc/callback` with any `code`, `state` or `error`. The flow does not trust them: a forged `code` fails the confidential-client exchange at Auth0, a forged `state` fails the cookie comparison (JS can neither read nor write an HttpOnly cookie), and the ID token is verified against the JWKS. This is precisely why the state cookie is load-bearing rather than a formality — see below.

Note that `error_description` is attacker-supplied and is reflected into the redirect URL. It is URL-encoded by `URLSearchParams`, and the frontend renders it only through an allowlist lookup with a constant fallback (`SIGN_IN_ERROR_DESCRIPTION_MAP`), never raw. Keep it that way.

### `redirect_url` query parameter

`/v1/auth/oidc/authorize` accepts an optional `redirect_url` query parameter. It is validated to be same-origin with `AUTH_POST_LOGIN_REDIRECT_URI`, then embedded in the state blob so it can be recovered after the Auth0 round-trip.

### CSRF protection

The `state` parameter passed through Auth0 is a base64url-encoded JSON blob:

```json
{ "csrf": "<64-char hex>", "redirectUrl": "https://...", "enroll": true }
```

`csrf` is 32 bytes of `randomBytes` hex; `redirectUrl` and `enroll` are both optional. The blob is stored verbatim in a short-lived HTTP-only cookie (`auth_state`, 5 min TTL). On callback, the gateway compares the full state string from the query param against the cookie value before proceeding. The state cookie is always cleared at the start of the callback handler, regardless of outcome.

The state is **not signed** — the cookie comparison is the only integrity check, and it carries three distinct guarantees:

1. **Login CSRF / session fixation.** Without it, an attacker who obtains a valid authorization code for *their own* Auth0 account could navigate a victim's browser to `/v1/auth/oidc/callback?code=<attacker code>&state=…`, and the gateway would mint an `access_token` cookie for the attacker's account in the victim's browser. Anything the victim then does — adding an address book entry, accepting a space invite — lands in the attacker's account. The cookie check blocks this because the victim's browser has no matching `auth_state`.
2. **Open redirect.** `redirectUrl` is read out of the state blob after the callback succeeds, and base64url is encoding, not authentication. Requiring the state to equal a cookie the gateway itself set is what prevents a hand-crafted state from steering the post-login redirect (and the `access_token` cookie's landing page) at an attacker-controlled origin. The same-origin validation at `/authorize` time only helps because state cannot be swapped afterwards.
3. **Privileged instructions in state.** `enroll` drives `cleanupSupersededAuthenticators()`, which deletes MFA (TOTP) enrollments. That flag must not be attacker-settable on someone else's callback.

The state cookie is `SameSite=Lax` in production rather than `Strict` deliberately: the Auth0 → callback hop is a cross-site top-level GET navigation, which `Lax` permits and `Strict` would drop, breaking every login. There is no PKCE and no OIDC `nonce` in this flow; code interception is instead mitigated by the confidential-client exchange (see below), and the state cookie is the browser-side binding.

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

| Env var                                            | Description                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `AUTH0_DOMAIN`                                     | Auth0 tenant domain, e.g. `tenant.auth0.com`                                                                 |
| `AUTH0_CLIENT_ID`                                  | Application client ID. Also the expected `aud` of the ID token                                               |
| `AUTH0_CLIENT_SECRET`                              | Application client secret. Used only server-to-server — see below                                            |
| `AUTH0_REDIRECT_URI`                               | Callback URL (must be allowlisted in Auth0)                                                                  |
| `AUTH0_API_AUDIENCE`                               | Sent as the `audience` parameter on `/authorize`, so Auth0 issues an API access token. Not an ID token claim |
| `AUTH0_SCOPE`                                      | Requested scopes, defaults to `openid`                                                                       |
| `AUTH0_JWKS_CACHE_MAX_AGE_MILLISECONDS`            | How long the tenant JWKS is cached, defaults to 1 hour                                                        |
| `AUTH0_JWKS_COOLDOWN_MILLISECONDS`                 | Minimum gap between JWKS refetches, defaults to 30s                                                          |
| `AUTH0_MANAGEMENT_API_TOKEN_TTL_BUFFER_IN_SECONDS` | Slack subtracted from the cached Management API token's TTL, defaults to 60s                                  |

All of these are `optional()` in `RootConfigurationSchema` because the module is only registered when `FF_OIDC_AUTH` is on (`app.module.ts`). With the flag on they are effectively required: every one is read with `getOrThrow` in a constructor, so a missing value fails at boot rather than at first login.

### ID token verification

`Auth0TokenVerifier` verifies the **`id_token`** from the token response with `jose`, against the tenant's JWKS at `https://{domain}/.well-known/jwks.json` (`createRemoteJWKSet`, cached and cooldown-limited per the env vars above):

- algorithm pinned to **RS256** (`JWT_RS_ALGORITHM`) — asymmetric, so the gateway holds no verification key
- `iss` must equal `https://{domain}/`
- `aud` must equal `AUTH0_CLIENT_ID` (the ID token's audience is the client, not the API)
- claims are then `Auth0TokenSchema.parse()`d, which requires a non-empty `sub` and rejects `email_verified: true` without an `email`

The `access_token` from the same response is schema-validated but otherwise unused: no `/userinfo` call, no Auth0 session-status lookup. Everything the gateway knows about the user comes from the locally verified ID token claims.

`OidcAuthService.authenticateWithOidc` then requires **both** `email` and `email_verified`, rejecting the login with a 401 otherwise, and maps the Auth0 `sub` to an internal numeric user ID via `usersRepository.findOrCreateByExtUserIdAndEmail()`.

### Client secret usage

`AUTH0_CLIENT_SECRET` is only ever sent from the gateway to `https://{domain}/oauth/token`, never to the browser. There are exactly two call sites, both in `auth0-api.service.ts`:

| Grant                | When                                                            | Why the secret                                                                                                                     |
| -------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `authorization_code` | Every OIDC callback, redeeming the `code` for tokens            | Authenticates the gateway as a confidential client, so a leaked or intercepted `code` is not redeemable by anyone else. This is what stands in for PKCE here |
| `client_credentials` | Fetching a Management API token (`audience` `/api/v2/`), cached | Machine-to-machine token for the MFA authenticator endpoints; needs `read:authentication_methods` and `delete:authentication_methods` |

Because the code exchange is a confidential-client, server-to-server call, the browser never sees an Auth0 token at all — it only ever receives the gateway's own `access_token` cookie.

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

## MFA authenticators

| Endpoint                             | Behaviour                                                                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/auth/oidc/mfa/authenticators` | `AuthGuard`-protected. Lists the caller's Auth0 authentication methods via the Management API, for the self-service authenticator management UI |

`/v1/auth/oidc/authorize?enroll=true` requests hosted enrollment of a new authenticator: an `ext-enroll-otp=true` parameter is added to the authorize URL, which the tenant's post-login Action reads from `event.request.query` to challenge an existing factor and then enroll a new one. The callback detects the round-trip via the `enroll` flag in the state blob and calls `cleanupSupersededAuthenticators()`, deleting every TOTP method except the most recently created one. Recovery codes are untouched.

Both paths resolve the Auth0 user ID from the verified gateway payload or callback result — never from request input — because the Management API token has tenant-wide access.

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

Applied at the **controller level** on `OidcAuthController`, so it covers `/oidc/authorize`, `/oidc/callback` and `/oidc/mfa/authenticators`. Configured via `AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW_SECONDS`.

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
