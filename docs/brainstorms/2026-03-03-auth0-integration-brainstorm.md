---
date: 2026-03-03
topic: auth0-integration
---

# Auth0 Integration Design

## What We're Building

An Auth0 authentication module that **complements** the existing SIWE (Sign-In With Ethereum) authentication. Users can authenticate via either method, and both produce the same gateway-issued JWT format.

### Goals

- Add Auth0 as an alternative authentication method for end users
- Proxy Auth0 through the gateway (BFF pattern) — frontend doesn't talk to Auth0 directly
- Issue gateway JWTs after Auth0 validation (same as SIWE flow)
- Support token refresh without requiring full re-authentication
- Maintain clean separation for future extraction to a dedicated auth service

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AUTHENTICATION FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────────┐
                         │      Frontend       │
                         └─────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
         ┌──────────────────┐          ┌──────────────────┐
         │   SIWE Login     │          │  Auth0 Login     │
         │   /auth/verify   │          │  /auth/auth0/*   │
         └──────────────────┘          └──────────────────┘
                    │                             │
                    ▼                             ▼
         ┌──────────────────┐          ┌──────────────────┐
         │ Verify wallet    │          │ Validate Auth0   │
         │ signature        │          │ token via JWKS   │
         └──────────────────┘          └──────────────────┘
                    │                             │
                    └──────────────┬──────────────┘
                                   ▼
                         ┌─────────────────────┐
                         │  Issue Gateway JWT  │
                         │  (HS256 + secret)   │
                         └─────────────────────┘
                                   │
                                   ▼
                         ┌─────────────────────┐
                         │  Set access_token   │
                         │  cookie (HttpOnly)  │
                         └─────────────────────┘
                                   │
                                   ▼
                         ┌─────────────────────┐
                         │  Protected Routes   │
                         │  (Single AuthGuard) │
                         └─────────────────────┘
```

## Auth0 Login Flow (BFF Pattern)

The gateway acts as the OAuth client, proxying all Auth0 communication.

```
┌──────────┐                    ┌─────────────────────┐                    ┌────────┐
│ Frontend │                    │      Gateway        │                    │ Auth0  │
└────┬─────┘                    │   (Auth0 Module)    │                    └───┬────┘
     │                          └──────────┬──────────┘                        │
     │  1. GET /auth/auth0/login           │                                   │
     │────────────────────────────────────▶│                                   │
     │                                     │                                   │
     │  2. Redirect (302)                  │                                   │
     │◀────────────────────────────────────│                                   │
     │     Location: auth0.com/authorize   │                                   │
     │     ?client_id=...                  │                                   │
     │     &redirect_uri=gateway/callback  │                                   │
     │     &code_challenge=...  (PKCE)     │                                   │
     │     &state=...           (CSRF)     │                                   │
     │                                     │                                   │
     │  3. User redirected to Auth0        │                                   │
     │─────────────────────────────────────────────────────────────────────────▶
     │                                     │                                   │
     │         4. User authenticates (email/password, SSO, social)             │
     │                                     │                                   │
     │  5. Redirect to gateway callback    │                                   │
     │◀─────────────────────────────────────────────────────────────────────────
     │     ?code=AUTH_CODE&state=...       │                                   │
     │                                     │                                   │
     │  6. GET /auth/auth0/callback?code=..│                                   │
     │────────────────────────────────────▶│                                   │
     │                                     │                                   │
     │                                     │  7. POST /oauth/token             │
     │                                     │     code + code_verifier (PKCE)   │
     │                                     │─────────────────────────────────▶│
     │                                     │                                   │
     │                                     │  8. { id_token, access_token,     │
     │                                     │       refresh_token }             │
     │                                     │◀─────────────────────────────────│
     │                                     │                                   │
     │                                     │  9. Validate id_token             │
     │                                     │     against Auth0 JWKS            │
     │                                     │                                   │
     │                                     │  10. Store refresh_token          │
     │                                     │      (server-side, keyed by user) │
     │                                     │                                   │
     │                                     │  11. Issue gateway JWT            │
     │                                     │      using JwtService.sign()      │
     │                                     │                                   │
     │  12. Set-Cookie: access_token=...   │                                   │
     │      (HttpOnly, Secure, SameSite)   │                                   │
     │◀────────────────────────────────────│                                   │
     │                                     │                                   │
     │  13. Redirect to app                │                                   │
     │◀────────────────────────────────────│                                   │
     │                                     │                                   │
```

## Token Refresh Flow

```
┌──────────┐                    ┌─────────────────────┐                    ┌────────┐
│ Frontend │                    │      Gateway        │                    │ Auth0  │
└────┬─────┘                    └──────────┬──────────┘                    └───┬────┘
     │                                     │                                   │
     │  1. Request with expired token      │                                   │
     │────────────────────────────────────▶│                                   │
     │                                     │                                   │
     │  2. 401 Unauthorized                │                                   │
     │◀────────────────────────────────────│                                   │
     │                                     │                                   │
     │  3. POST /auth/auth0/refresh        │                                   │
     │────────────────────────────────────▶│                                   │
     │                                     │                                   │
     │                                     │  4. Retrieve stored refresh_token │
     │                                     │     (from Redis/DB by user ID)    │
     │                                     │                                   │
     │                                     │  5. POST /oauth/token             │
     │                                     │     grant_type=refresh_token      │
     │                                     │─────────────────────────────────▶│
     │                                     │                                   │
     │                                     │  6. { new access_token,           │
     │                                     │       new refresh_token }         │
     │                                     │◀─────────────────────────────────│
     │                                     │                                   │
     │                                     │  7. Store new refresh_token       │
     │                                     │                                   │
     │                                     │  8. Issue new gateway JWT         │
     │                                     │                                   │
     │  9. Set-Cookie: access_token=...    │                                   │
     │◀────────────────────────────────────│                                   │
     │                                     │                                   │
```

## API Endpoints

### New Auth0 Endpoints

| Endpoint                  | Method | Description                                                    |
| ------------------------- | ------ | -------------------------------------------------------------- |
| `/v1/auth/auth0/login`    | GET    | Initiates Auth0 login, redirects to Auth0                      |
| `/v1/auth/auth0/callback` | GET    | Handles Auth0 callback, exchanges code for tokens              |
| `/v1/auth/auth0/refresh`  | POST   | Refreshes expired gateway JWT using stored Auth0 refresh token |
| `/v1/auth/auth0/logout`   | POST   | Clears session and optionally logs out from Auth0              |

### Existing Endpoints (Unchanged)

| Endpoint          | Method | Description                              |
| ----------------- | ------ | ---------------------------------------- |
| `/v1/auth/nonce`  | GET    | Get SIWE nonce                           |
| `/v1/auth/verify` | POST   | Verify SIWE signature, issue gateway JWT |
| `/v1/auth/logout` | POST   | Clear access_token cookie                |

## Key Decisions

### 1. BFF Pattern (Gateway as OAuth Client)

**Decision:** Frontend does not communicate directly with Auth0.

**Rationale:**

- Simplifies frontend implementation (no Auth0 SDK needed)
- Client secret stays server-side (more secure)
- Enables server-side refresh token storage
- Gateway controls the entire auth flow

### 2. Gateway-Issued JWTs

**Decision:** After Auth0 validates a user, the gateway issues its own JWT (same as SIWE).

**Rationale:**

- Unified token format regardless of auth method
- Routes only understand one token structure
- Decoupled from Auth0's token format
- Easier to extract auth to separate service later
- Existing AuthGuard works without modification

### 3. HS256 Symmetric Algorithm

**Decision:** Continue using HS256 for gateway JWTs.

**Rationale:**

- Only the gateway signs and validates tokens
- Simpler and faster than asymmetric algorithms
- Existing infrastructure already uses HS256
- Secret management is straightforward

### 4. Server-Side Refresh Token Storage

**Decision:** Store Auth0 refresh tokens in Redis/database, keyed by user ID.

**Rationale:**

- Refresh tokens never exposed to frontend
- Enables seamless token refresh
- Required for the BFF pattern
- Supports token revocation (delete stored refresh token)

### 5. PKCE for Authorization Flow

**Decision:** Use PKCE (Proof Key for Code Exchange) even with a confidential client.

**Rationale:**

- Defense in depth
- Prevents authorization code interception
- Industry best practice
- Required for some Auth0 configurations

## Module Structure

```
src/
├── modules/
│   ├── auth/                          # Existing SIWE auth
│   │   ├── auth.module.ts
│   │   ├── routes/
│   │   │   ├── auth.controller.ts     # /auth/nonce, /auth/verify, /auth/logout
│   │   │   ├── auth.service.ts
│   │   │   └── guards/
│   │   │       ├── auth.guard.ts      # Validates gateway JWT (unchanged)
│   │   │       └── optional-auth.guard.ts
│   │   └── domain/
│   │       └── entities/
│   │           └── auth-payload.entity.ts
│   │
│   └── auth0/                         # New Auth0 module
│       ├── auth0.module.ts
│       ├── routes/
│       │   ├── auth0.controller.ts    # /auth/auth0/* endpoints
│       │   └── auth0.service.ts       # Auth0 OAuth logic
│       ├── domain/
│       │   ├── auth0.repository.ts    # Token exchange, JWKS validation
│       │   └── entities/
│       │       └── auth0-user.entity.ts
│       └── infrastructure/
│           └── auth0-refresh-token.repository.ts  # Redis/DB storage
│
├── datasources/
│   └── jwt/                           # Existing JWT infrastructure (unchanged)
│       ├── jwt.module.ts
│       └── jwt.service.ts
```

## Configuration

```yaml
# New configuration for Auth0
auth0:
  domain: 'your-tenant.auth0.com'
  clientId: '${AUTH0_CLIENT_ID}'
  clientSecret: '${AUTH0_CLIENT_SECRET}'
  callbackUrl: '${AUTH0_CALLBACK_URL}' # e.g., https://gateway.safe.global/v1/auth/auth0/callback
  audience: '${AUTH0_AUDIENCE}' # Optional: API identifier
  scopes: 'openid profile email'

# Existing JWT configuration (unchanged)
jwt:
  issuer: 'safe-client-gateway'
  secret: '${JWT_SECRET}'
```

## Security Considerations

### Implemented

| Control               | Implementation                                          |
| --------------------- | ------------------------------------------------------- |
| HttpOnly cookies      | `httpOnly: true` — tokens not accessible via JavaScript |
| Secure cookies        | `secure: true` — HTTPS only                             |
| SameSite cookies      | `sameSite: 'lax'` — CSRF protection                     |
| Algorithm enforcement | Explicitly specify `HS256` in validation                |
| PKCE                  | Code challenge/verifier in OAuth flow                   |
| State parameter       | CSRF protection in OAuth flow                           |
| Server-side secrets   | Client secret and JWT secret never exposed              |

### Requirements

| Requirement            | Action Needed                                            |
| ---------------------- | -------------------------------------------------------- |
| Strong JWT secret      | Ensure 256+ bits of entropy: `openssl rand -base64 32`   |
| Refresh token storage  | Implement secure storage (Redis with encryption at rest) |
| Callback URL whitelist | Configure exact URLs in Auth0 dashboard                  |
| Token expiration       | Keep gateway JWTs short-lived (15-60 min)                |

### Optional Enhancements

| Enhancement     | Benefit                                         |
| --------------- | ----------------------------------------------- |
| Token deny-list | Immediate revocation for logout/security events |
| Rate limiting   | Prevent brute-force on auth endpoints           |
| Audit logging   | Track authentication events                     |

## Token Comparison

| Aspect        | SIWE Token                     | Auth0 Token (pass-through) | Gateway Token (chosen) |
| ------------- | ------------------------------ | -------------------------- | ---------------------- |
| Issuer        | Gateway                        | Auth0                      | Gateway                |
| Validation    | Gateway secret                 | Auth0 JWKS                 | Gateway secret         |
| Format        | Unified                        | Auth0-specific             | Unified                |
| Claims        | `{ chain_id, signer_address }` | `{ sub, email, ... }`      | Normalized             |
| Guard changes | None                           | Required                   | None                   |

## Open Questions

1. **Refresh token storage:** Redis vs PostgreSQL? (Redis preferred for TTL support)
2. **User identity mapping:** How to link Auth0 users to existing SIWE identities if same user?
3. **Auth0 logout:** Should gateway logout also trigger Auth0 logout (federated logout)?
4. **Scopes/permissions:** What Auth0 scopes/claims are needed beyond basic profile?

## Next Steps

1. **Planning phase:** Run `/workflows:plan` to create detailed implementation tasks
2. **Auth0 setup:** Configure Auth0 tenant, application, and callback URLs
3. **Implementation:** Build Auth0 module following the structure above
4. **Testing:** Integration tests for the full OAuth flow

---

## Appendix: Alternative Approach — Direct Auth0 Token Usage

This section documents an alternative approach where Auth0 tokens are used directly instead of issuing gateway JWTs. This approach was considered but not chosen for this implementation.

### How It Would Work

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DIRECT AUTH0 TOKEN FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────────┐
                         │      Frontend       │
                         └─────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
         ┌──────────────────┐          ┌──────────────────┐
         │   SIWE Login     │          │  Auth0 Login     │
         └──────────────────┘          └──────────────────┘
                    │                             │
                    ▼                             ▼
         ┌──────────────────┐          ┌──────────────────┐
         │  Gateway JWT     │          │  Auth0 JWT       │
         │  (HS256)         │          │  (RS256)         │
         └──────────────────┘          └──────────────────┘
                    │                             │
                    ▼                             ▼
         ┌──────────────────┐          ┌──────────────────┐
         │  Validate with   │          │  Validate with   │
         │  gateway secret  │          │  Auth0 JWKS      │
         └──────────────────┘          └──────────────────┘
                    │                             │
                    └──────────────┬──────────────┘
                                   ▼
                         ┌─────────────────────┐
                         │   AuthGuard must    │
                         │   handle BOTH       │
                         │   token formats     │
                         └─────────────────────┘
```

### Authentication Flow

```
┌──────────┐                    ┌─────────────────────┐                    ┌────────┐
│ Frontend │                    │      Gateway        │                    │ Auth0  │
└────┬─────┘                    └──────────┬──────────┘                    └───┬────┘
     │                                     │                                   │
     │  1-6. Same OAuth flow as chosen approach                                │
     │       (login → Auth0 → callback → code exchange)                        │
     │                                     │                                   │
     │                                     │  7. Receive Auth0 tokens          │
     │                                     │     { id_token, access_token,     │
     │                                     │       refresh_token }             │
     │                                     │                                   │
     │                                     │  8. Store refresh_token           │
     │                                     │     (server-side)                 │
     │                                     │                                   │
     │  9. Set-Cookie: access_token=       │                                   │
     │     <Auth0's access_token directly> │   ← KEY DIFFERENCE                │
     │◀────────────────────────────────────│                                   │
     │                                     │                                   │

Subsequent requests:
     │                                     │                                   │
     │  Request + Auth0 token in cookie    │                                   │
     │────────────────────────────────────▶│                                   │
     │                                     │                                   │
     │                                     │  Fetch Auth0 JWKS (cached)        │
     │                                     │─────────────────────────────────▶│
     │                                     │◀─────────────────────────────────│
     │                                     │                                   │
     │                                     │  Validate token signature         │
     │                                     │  against JWKS public key          │
     │                                     │                                   │
```

### Modified AuthGuard Logic

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies['access_token'];

    if (!token) return false;

    // Decode header to check issuer WITHOUT validating
    const decoded = this.jwtService.decodeHeader(token);

    if (this.isAuth0Token(decoded)) {
      // Validate against Auth0 JWKS (RS256)
      return this.validateAuth0Token(token);
    } else {
      // Validate against gateway secret (HS256)
      return this.validateGatewayToken(token);
    }
  }

  private isAuth0Token(decoded: JwtHeader): boolean {
    // Check issuer claim or algorithm
    return decoded.alg === 'RS256' && decoded.kid !== undefined;
  }
}
```

### Benefits

| Benefit                    | Description                                                   |
| -------------------------- | ------------------------------------------------------------- |
| **Simpler token issuance** | No need to create gateway JWT after Auth0 login               |
| **Direct Auth0 features**  | Can use Auth0's token introspection, revocation APIs directly |
| **Reduced code**           | No token transformation logic                                 |
| **Auth0 token lifetime**   | Use Auth0's token expiration policies directly                |
| **Standard OAuth**         | More conventional OAuth2 resource server pattern              |

### Drawbacks

| Drawback                                 | Impact                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Dual validation logic**                | AuthGuard must handle two different token formats and validation mechanisms                           |
| **External dependency on every request** | Must fetch/cache Auth0 JWKS; if Auth0 is down, validation fails                                       |
| **Different claim structures**           | SIWE tokens have `{ chain_id, signer_address }`, Auth0 has `{ sub, email }` — routes must handle both |
| **Tighter coupling to Auth0**            | Token format, claims, expiration all controlled by Auth0                                              |
| **Harder to extract later**              | Moving auth to separate service means changing all validation logic                                   |
| **JWKS caching complexity**              | Must implement proper JWKS caching with rotation handling                                             |
| **No unified identity model**            | Hard to correlate SIWE users with Auth0 users                                                         |

### Token Refresh Comparison

**With pass-through:**

```typescript
// Refresh returns Auth0's token directly
async refresh(userId: string): Promise<void> {
  const refreshToken = await this.storage.get(userId);
  const { access_token } = await this.auth0.refreshToken(refreshToken);

  // Set Auth0's token directly in cookie
  res.cookie('access_token', access_token);
}
```

**With gateway JWT (chosen approach):**

```typescript
// Refresh validates Auth0 token, then issues gateway JWT
async refresh(userId: string): Promise<void> {
  const refreshToken = await this.storage.get(userId);
  const { id_token } = await this.auth0.refreshToken(refreshToken);

  // Validate and extract claims
  const claims = await this.validateAuth0Token(id_token);

  // Issue gateway JWT with normalized claims
  const gatewayToken = this.jwtService.sign({
    sub: claims.sub,
    email: claims.email,
    iss: 'safe-client-gateway',
  });

  res.cookie('access_token', gatewayToken);
}
```

### JWKS Caching Requirements

If using Auth0 tokens directly, you must implement JWKS caching:

```typescript
@Injectable()
export class Auth0JwksService {
  private jwksCache: Map<string, JWK> = new Map();
  private cacheExpiry: Date;

  async getSigningKey(kid: string): Promise<JWK> {
    if (this.isCacheExpired() || !this.jwksCache.has(kid)) {
      await this.refreshJwks();
    }

    const key = this.jwksCache.get(kid);
    if (!key) {
      throw new UnauthorizedException('Unknown signing key');
    }
    return key;
  }

  private async refreshJwks(): Promise<void> {
    const response = await fetch(
      `https://${this.domain}/.well-known/jwks.json`,
    );
    const jwks = await response.json();

    this.jwksCache.clear();
    for (const key of jwks.keys) {
      this.jwksCache.set(key.kid, key);
    }

    // Cache for 10 minutes, but handle rotation
    this.cacheExpiry = new Date(Date.now() + 10 * 60 * 1000);
  }
}
```

### When to Consider This Approach

Direct Auth0 token usage might be appropriate when:

1. **Auth0 is the only auth method** — No SIWE or other providers to unify
2. **Short-term implementation** — Quick MVP without plans for auth extraction
3. **Auth0-specific features needed** — Using Auth0's RBAC, Actions, or token introspection
4. **Microservices already validate Auth0** — Other services already use Auth0 JWKS validation

### Why We Chose Gateway JWTs Instead

For this implementation, gateway-issued JWTs were chosen because:

1. **Unified token format** — SIWE and Auth0 users get identical tokens
2. **Single validation path** — AuthGuard unchanged, validates one format
3. **Decoupled from Auth0** — Auth0 is an implementation detail, not a dependency
4. **Future extraction ready** — Moving auth to separate service requires minimal changes
5. **Simpler guards** — No conditional validation logic based on token type
6. **Consistent claim structure** — Routes receive normalized user identity

---

_Generated from brainstorming session on 2026-03-03_
