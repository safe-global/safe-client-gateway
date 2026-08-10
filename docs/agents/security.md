<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Security

Safe Client Gateway is the internet-facing boundary in front of a crypto-wallet backend: every request it accepts can, a few hops later, touch a Safe that holds real assets, so a validation gap or an authentication shortcut here is never cosmetic.
Every rule below traces to a real incident class from this service's own history or to a standing risk class inherent to fronting user funds — treat each one as a hard constraint, not a style preference.

### Pipe every input

**Rule:** Validate every `@Param`, `@Query`, and `@Body` controller argument in its own signature with `new ValidationPipe(SomeZodSchema)`; never declare a bare `@Param()`/`@Query()`/`@Body()`, and never reach past the pipe into `request.body`/`request.query`/`request.params` inside a handler.

**Why:** an unvalidated parameter flows unchanged into upstream URL paths built by a datasource further down the call chain; the boundary is enforced per parameter, not per route, so one unpiped argument reopens the hole every other parameter on the same route already closed.

**Canonical example:** `src/modules/targeted-messaging/routes/targeted-messaging.controller.ts` — `getTargetedSafe` validates all three route params in place: `@Param('outreachId', ParseIntPipe, new ValidationPipe(TargetedSafeSchema.shape.outreachId))`, `@Param('chainId', new ValidationPipe(NumericStringSchema))`, and `@Param('safeAddress', new ValidationPipe(AddressSchema))`.

A pipe failure throws `ZodErrorWithCode`, not a generic `BadRequestException` — a caller sees a 422 with the specific validation issue, which is also how a reviewer can tell a route was actually piped rather than validated ad hoc further down.

### No raw values in upstream URLs

**Rule:** Only the output of a Zod schema — `AddressSchema`, `NumericStringSchema`/`ChainIdSchema`, `UuidSchema` — may be interpolated into a datasource's upstream URL path template; anything added as a query parameter goes through the shared URL builder in `src/datasources/network/fetch.network.service.ts`, never manual string concatenation.

**Why:** an unvalidated value spliced into an upstream request path is a path-traversal vector into the internal services CGW proxies to.

**Canonical example:** `src/datasources/network/fetch.network.service.ts`'s private `buildUrl` constructs a `URL` object from the base and appends each parameter with `urlObject.searchParams.append(key, String(value))`; every `get`/`post`/`postForm`/`delete` method routes through it, so no call site hand-builds a query string.

This applies whether the datasource is module-owned (`src/modules/*/datasources/`) or still central (`src/datasources/*-api/`) — the trust boundary is the value's provenance, not which tree the client happens to live in.

### Guards are mandatory, not optional

**Rule:** A route that mutates state or returns data scoped to the authenticated caller's own account (session, profile, memberships, notification preferences) declares `@UseGuards(AuthGuard)` together with `@Auth() authPayload` (or `@UseGuards(OptionalAuthGuard)`, only with a justification recorded in the PR description); an internal or service-to-service route instead declares `@UseGuards(BasicAuthGuard)` or a signature guard (e.g. `TenderlySignatureGuard`). Data merely keyed by a public on-chain address — most CGW read endpoints — is public by design and carries no auth guard.

**Why:** PR #290 — cache-hook endpoints shipped with no auth guard at all, so anything that could reach their path could trigger them.

**Canonical example:** `src/modules/auth/routes/auth.controller.ts`'s `getMe` pairs `@UseGuards(AuthGuard)` with `@Auth() authPayload: AuthPayload`. For the internal-route half of the rule, `src/modules/hooks/routes/hooks.controller.ts` guards its event-ingestion route with `@UseGuards(BasicAuthGuard)` on `POST /hooks/events`.

`OptionalAuthGuard` letting a request through with no cookie present is only safe when every downstream branch treats a missing `authPayload` as unauthenticated; it is never a substitute for `AuthGuard` on a route that actually requires a signed-in user.

### Ownership by signature recovery only

**Rule:** An endpoint that binds a wallet/signer to an account verifies a fresh signed message — a SIWE message and signature for login/session binding, or an equivalent recovered-signature check for other wallet-binding flows — and trusts only the address the verification resolves to; a client-supplied address field is never accepted as an ownership claim on its own.

**Why:** PR #2345 — any wallet address could be attached to an account without proving control of it.

**Canonical example:** `src/modules/siwe/domain/siwe.repository.ts`'s `getValidatedSiweMessage` calls viem's `verifyMessage` against the address embedded in the parsed SIWE message, and returns that message — address included — only once the signature cryptographically recovers to it. The binding site: `src/modules/users/routes/users.service.ts`'s `addWalletToUser` takes `walletAddress` from that verified `message.address`, never from a request field supplying an address directly.

The recovered-signature variant in the Rule: `src/modules/notifications/routes/v1/notifications.controller.ts` derives the device-registration signer via viem's `recoverAddress`/`recoverMessageAddress`, never from a client-supplied `signer_address` field.

### JWT only via IJwtService

**Rule:** Never import `jsonwebtoken` or `jose` outside `src/datasources/jwt/`; sign and verify with an explicitly pinned algorithm; set and verify both `iss` and `aud`; bound every issued token's `exp` by a max-validity constant rather than trusting a client-supplied expiry outright.

**Why:** PR #2104 — algorithm confusion from an unpinned verify call; PR #1413 — an unbounded SIWE expiry let a client mint an arbitrarily long-lived JWT.

**Canonical example:** `src/datasources/jwt/jwt.service.ts` defaults both `sign`'s `algorithm` and `verify`'s `algorithms` to `JWT_HS_ALGORITHM`, and defaults `iss`/`aud` to the configured issuer on both operations. The bounding half: `src/modules/auth/utils/token-expiration.utils.ts`'s `assertExpirationTime` throws when a SIWE-supplied `expirationTime` exceeds `getMaxExpirationTime(auth.maxValidityPeriodSeconds)`, called from `src/modules/auth/routes/auth.service.ts` before any token is signed.

`IJwtService` also exposes `decodeWithoutVerification`; it exists only for contexts that grant nothing on its result — e.g. reading `auth_method` during logout in `src/modules/auth/routes/auth.service.ts`'s `getLogoutRedirectUrl` — never for a decision that authorizes a request.

### Replay protection on signed payloads

**Rule:** A client-signed payload embeds either a server-generated single-use nonce that the server clears the moment it is read for verification, or a client-supplied timestamp checked against a bounded max age, before the payload is trusted.

**Why:** PR #2192 — device registration was replayable: a captured registration request could be resent indefinitely because nothing on the server side expired or single-used it.

**Canonical example:** `src/modules/siwe/domain/siwe.repository.ts` — `generateNonce` stores a fresh `generateSiweNonce()` value via `siweApi.storeNonce`, and `getValidatedSiweMessage` looks the nonce up, calls `siweApi.clearNonce` on it immediately, and only then verifies the signature, so the nonce is consumed on first use regardless of whether that signature check succeeds:

```ts
const cachedNonce = await this.siweApi.getNonce(result.data.nonce);
if (!cachedNonce) {
  throw new UnauthorizedException('Invalid nonce');
}
await this.siweApi.clearNonce(result.data.nonce);
const isValidSignature = await verifyMessage({ /* ... */ }).catch(() => false);
```

The message's own `issuedAt`/`expirationTime` window is additionally checked against `auth.clockSkewSeconds`, read in the same repository's constructor and passed into `buildSiweMessageSchema`. The timestamp variant: `src/modules/notifications/routes/v1/notifications.controller.ts`'s `validateTimestamp` rejects a device registration whose `timestamp` differs from the current time by more than the fixed `REGISTRATION_TIMESTAMP_EXPIRY`.

The same single-use nonce lifecycle is described in `docs/agents/ARCHITECTURE.md`'s AuthN/AuthZ section; this rule is its normative form for any new client-signed payload.

### Never hand-read client IP headers

**Rule:** Read a client's IP only via Fastify's `request.ip` (resolved through `trustProxy`, configured in `src/app.provider.ts`); never parse `X-Forwarded-For` or any other client-controlled header by hand; a guard keyed on IP rejects a request whose `request.ip` doesn't parse as an IP address rather than falling back to a header value.

**Why:** PR #3170 — a hand-parsed, spoofable XFF header fed rate-limit/captcha/blocklist keys, so a client could pick which bucket its own requests were rate-limited under.

**Canonical example:** `src/routes/common/guards/rate-limit.guard.ts` validates `req.ip` with `z.union([z.ipv4(), z.ipv6()])` and throws `BadRequestException('Invalid client IP address')` before `req.ip` is ever used to build the rate-limit cache key.

`trustProxy` itself (`express.trustProxy` in configuration, despite the `express.*` namespace predating the Fastify migration) is a comma-separated subnet/preset list or a hop count — it bounds how many proxy hops Fastify trusts before it stops adjusting `request.ip`, which is what keeps the value trustworthy in the first place.

### Constant-time secret comparison

**Rule:** Compare a token, HMAC, or digest only with `crypto.timingSafeEqual`; never compare a secret with `===`/`==`. `timingSafeEqual` requires equal-length buffers, so handle a length mismatch one of two ways: treat it as comparison failure (the canonical guard below wraps the call in try/catch for exactly this), or hash both sides to a fixed length first when inputs can legitimately vary in length.

**Why:** a variable-time comparison leaks how many leading bytes matched through response timing, letting a remote attacker recover a secret byte-by-byte instead of needing to guess it whole.

**Canonical example:** `src/modules/alerts/routes/guards/tenderly-signature.guard.ts`'s `isValidSignature` wraps `crypto.timingSafeEqual(signatureBuffer, digestBuffer)` in a try/catch, since the function throws on unequal-length buffers rather than returning false.

The signing key itself (`alerts-route.signingKey`) is read once at construction via `IConfigurationService`, never inlined — see the env-var rule below for that half of the pattern.

### Every env var through the schema

**Rule:** Map a new environment variable into `src/config/entities/configuration.ts` and declare it in `RootConfigurationSchema` (`src/config/entities/schemas/configuration.schema.ts`); give a secret no hardcoded fallback default; enforce any deployed-environment-only requirement in the schema's `superRefine`; never let a private signing key be usable in a deployed environment — signing there goes through KMS only.

**Why:** a secret with a silent fallback default, or a config surface with no schema entry, is invisible to review; the deployed-only refinements are how this repo catches configuration that should only ever exist in an offline provisioning step before it reaches the running service.

**Canonical example:** the ordinary map-and-validate pair — `CAPTCHA_SECRET_KEY` is read at `src/config/entities/configuration.ts`'s `captcha.secretKey` and declared in `src/config/entities/schemas/configuration.schema.ts` as `z.string().optional()`. The private-key refinement lives in the same schema file:

```ts
if (isDeployedEnv && config.BILLING_WEBHOOK_JWT_PRIVATE_KEY) {
  ctx.addIssue({
    code: 'custom',
    message:
      'must not be set in production and staging environments; sign via KMS (BILLING_WEBHOOK_JWT_KMS_KEY_ID) instead',
    path: ['BILLING_WEBHOOK_JWT_PRIVATE_KEY'],
  });
}
```

Unlike the schema's `superRefine` above, `configuration.ts` — the map, not the validator — never reads that variable into the running config at all: only the public key and the KMS key id are wired in, so the private key has no path into the live process even before this refinement fires.

### Abuse controls on unauthenticated endpoints

**Rule:** A new unauthenticated POST or lookup endpoint attaches a `RateLimitGuard` subclass in its controller decorators, and — when the data it returns is scraping-prone — also `CaptchaGuard` (`src/routes/captcha/guards/captcha.guard.ts`).

**Why:** PR #2995 — the OIDC login route was abused at volume before a dedicated rate limit was added; PR #2892 — the owner-lookup endpoint was scraped at volume before a captcha guard was added.

**Canonical example:** `src/modules/owners/routes/owners.controller.v3.ts`'s `getAllSafesByOwner` (`GET /v3/owners/:ownerAddress/safes`, no `AuthGuard` on the route at all) declares `@UseGuards(CaptchaGuard)`. `src/modules/auth/oidc/routes/oidc-auth.controller.ts` declares `@UseGuards(OidcAuthRateLimitGuard)` — a `RateLimitGuard` subclass — on its login route.

`RateLimitGuard` is a base class, not a shared singleton limiter: each call site subclasses it with its own `{ max, windowSeconds }`, so traffic against one endpoint's limit can never exhaust another's — the `spaces` module's address-book guards (`src/modules/spaces/routes/address-books/guards/`) are further instances of the same subclassing pattern.

The same base-class design is described in `docs/agents/ARCHITECTURE.md`'s AuthN/AuthZ section; this rule adds the requirement that a new unauthenticated endpoint actually attaches a subclass.

### PII at rest = KMS field-encryption pattern

**Rule:** Never store a PII column as plaintext; encrypt it through the KMS field-encryption pattern — an entity-bound encryption context, a versioned stored-ciphertext prefix, and a keyed blind index for equality lookups — and treat the constants that define that on-disk format as frozen the moment any ciphertext or index value exists on disk.

**Why:** a plaintext PII column is one database read away from full exposure; the blind index exists so encrypting a column doesn't cost the service its ability to do equality lookups (uniqueness checks, lookup-by-email) on it.

**Canonical example:** `src/datasources/kms/encryption.constants.ts` documents the on-disk contract as immutable: the `kms:v1:` prefix, the envelope blob layout (wrapped data key + IV + ciphertext + GCM tag), and the blind-index HMAC label and key length. `src/datasources/kms/kms-encryption.service.ts` is the single, domain-free implementation of the mechanics: `encrypt`/`decrypt` pass the caller-supplied `encryptionContext` to KMS as AAD (and bind it again locally as GCM AAD) so a value can't be transplanted to another owner, and `blindIndex` computes a keyed HMAC over the normalised plaintext for lookups without ever decrypting stored rows. `src/modules/users/domain/user-encryption.service.ts` shows how a module consumes it: a thin wrapper that binds the owning row's id into the context — `this.kmsEncryption.encrypt(email, { userId: String(userId) })` — and adds batch helpers, but implements no crypto of its own.

The pattern is implemented today for `users.email`, wallet addresses, member names/aliases, and the `spaces` module's names, Safe addresses, address-book entries, and audit payloads — each via its own thin wrapper (`UserEncryptionService`, `WalletEncryptionService`, `MemberEncryptionService`, `SpaceEncryptionService`). A new PII column gets the same shape: extend the owning module's wrapper (or add one if the module has none) to bind that entity's `encryptionContext` and delegate to `KmsEncryptionService` — never reimplement the envelope or blind-index mechanics per field, and never alter the constants, which are a frozen on-disk contract.

### Sanitize user text

**Rule:** Pass user-supplied text that will later be rendered, emailed, or persisted for display through `makeNameSchema`/`NameSchema` (`src/domain/common/schemas/name.schema.ts`) or `sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })` before it is stored or returned.

**Why:** free-text a client controls, if it reaches another client's UI or an email template unsanitized, is a stored-XSS vector — worse here than in a typical app, since the UI it reaches is a wallet interface used to review and sign transactions.

**Canonical example:** `src/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-note.mapper.ts`'s `mapTxNote` extracts a transaction's note from its `origin` JSON and runs it through `sanitizeHtml(origin.note, { allowedAttributes: {}, allowedTags: [], allowedIframeHostnames: [] })` before returning it.

Use the `NameSchema` family for short structured fields — a Safe name, a contact name — and `sanitizeHtml` for free text that may otherwise carry markup, such as a transaction note; picking the wrong one of the two is itself a review finding, since a length/character-class schema is not a substitute for markup stripping and vice versa.

### Redirects via allowlist

**Rule:** Validate a redirect target's shape with `RedirectUrlSchema` (`src/validation/entities/schemas/redirect-url.schema.ts`) and then resolve it against a same-origin/allowlisted-domain check before use; never call `res.redirect(<user input>)`/`reply.redirect(<user input>)` with a value that skipped either step.

**Why:** an unvalidated or unchecked redirect target is an open-redirect vector — a link through this service's own domain that a phishing page can hide behind for legitimacy.

**Canonical example:** `LogoutDtoSchema` (`src/modules/auth/routes/entities/logout.dto.entity.ts`) validates the request body's `redirect_url` with `RedirectUrlSchema`, which bounds its length and rejects control characters. `src/modules/auth/utils/auth-redirect.helper.ts`'s `resolveAndValidateRedirectUrl`/`isAllowedRedirectUrl` then resolve that value and require an exact origin match in production (or an explicit `auth.allowedRedirectDomain`, or a subdomain of it, over `https:` outside production), before `src/modules/auth/routes/auth.controller.ts`'s `logoutWithRedirect` passes the result to `res.redirect`.

Outside production, the same allowlist also accepts `localhost`/`127.0.0.1`/`[::1]` over plain `http:` — the RFC 8252 loopback exception that lets a local frontend authenticate against a deployed environment — but only for those exact hostnames, and never in production.

### Domain freshness in verifiers

**Rule:** Proposal and confirmation verification rejects a nonce below the Safe's current on-chain nonce, an already-executed transaction, and a blocklisted signer, each via `HttpExceptionNoLog` rather than a silently-swallowed rejection or a generic 500.

**Why:** PR #2408 — a stale-nonce/already-executed transaction could be replayed through verification; PRs #2399/#2405 — a blocklisted signer's confirmation was accepted.

**Canonical example:** `src/modules/transactions/routes/helpers/transaction-verifier.helper.ts` — `verifyConfirmation` throws `HttpExceptionNoLog(ErrorMessage.InvalidNonce, ...)` when `transaction.isExecuted || transaction.nonce < safe.nonce`:

```ts
if (args.transaction.isExecuted || args.transaction.nonce < args.safe.nonce) {
  throw new HttpExceptionNoLog(ErrorMessage.InvalidNonce, code);
}
```

`verifyApiSignatures`, `verifyProposalSignature`, and `verifyConfirmationSignature` each separately throw `HttpExceptionNoLog(ErrorMessage.BlockedAddress, ...)` when a recovered signer address is found in `this.blocklist` (backed by `IBlocklistService`), before the signature is even checked against the Safe's owners.

### Structured logging only

**Rule:** Never log a request body, token, cookie, email address, or raw request URL; log through route templates and an explicit, whitelisted set of fields chosen at each call site.

**Why:** no central redaction layer exists in this service, so call-site discipline is the only control against a secret or PII value ending up in log storage.

**Canonical example:** `src/routes/common/http/http-request.utils.ts`'s `getRoutePath` returns the matched Fastify route template (`routeOptions.url`/`route.path`, falling back to a fixed `'unknown'` sentinel), not the request's actual URL, so a call site logging `getRoutePath(req)` cannot leak a request-specific path segment. `src/routes/common/guards/rate-limit.guard.ts`'s `logRateLimitHit` logs only `method`, `route: getRoutePath(req)`, `clientIp`, and the configured/observed counters — never headers or body.

This is distinct from the error-handling split documented in `docs/agents/ARCHITECTURE.md`: a filter there decides whether an exception is logged at all, while this rule governs what a call site is allowed to put into the fields it does log.
