# CGW as a Sign-in with Ethereum OIDC provider

This module exposes CGW as a minimal OAuth 2.0/OIDC identity provider backed
by Sign-in with Ethereum (SiWe), modelled after
[spruceid/siwe-oidc](https://github.com/spruceid/siwe-oidc). It reuses the
existing SiWe nonce and signature validation (`ISiweRepository`, the same code
path as `/v1/auth/verify`) and only adds the OAuth 2.0 authorization code flow
around it, so that upstream identity platforms (e.g. an Auth0 custom social
connection) can offer "Sign in with Ethereum".

## Flow

```
Auth0 ── GET /v1/oauth2/authorize ──► CGW ── 302 ──► Safe{Wallet} sign-in page
                                                        │ user signs SiWe message
                                      CGW ◄── POST /v1/oauth2/signin ──┘
                                        │ validates nonce + signature,
                                        │ issues single-use code
Auth0 ◄── 302 redirect_uri?code=...&state=... (via browser)
  │
  ├── POST /v1/oauth2/token (client_id/client_secret) ──► access_token, id_token
  └── GET  /v1/oauth2/userinfo (Bearer access_token) ──► { sub: 0x..., chain_id }
```

## Endpoints

| Endpoint                             | Purpose                                              |
| ------------------------------------ | ---------------------------------------------------- |
| `GET /.well-known/openid-configuration` | OIDC discovery document                           |
| `GET /v1/oauth2/authorize`           | Authorization endpoint, redirects to the sign-in page |
| `POST /v1/oauth2/signin`             | Called by the sign-in page with the signed SiWe message |
| `POST /v1/oauth2/token`              | Token endpoint (authorization code grant)            |
| `GET /v1/oauth2/userinfo`            | Returns the signer address for a Bearer access token |

The `sub` claim (and `address`) is the checksummed signer address; `chain_id`
is the chain the SiWe message was signed for.

## Configuration

Client credentials are static and provisioned manually via environment
variables — there is no dynamic client registration.

| Variable                                  | Description                                                        |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `FF_OIDC_PROVIDER`                        | Feature flag, set to `true` to enable the module                   |
| `OIDC_PROVIDER_CLIENT_ID`                 | The client ID, e.g. a random string you generate                   |
| `OIDC_PROVIDER_CLIENT_SECRET`             | The client secret, e.g. `openssl rand -hex 32`                     |
| `OIDC_PROVIDER_REDIRECT_URIS`             | Comma-separated allow-list of redirect URIs, e.g. `https://TENANT.auth0.com/login/callback` |
| `OIDC_PROVIDER_SIGN_IN_PAGE_URL`          | The Safe{Wallet} sign-in page, e.g. `https://app.safe.global/oidc-signin` |
| `OIDC_PROVIDER_ISSUER`                    | Public base URL of this CGW, e.g. `https://safe-client.safe.global` |
| `OIDC_PROVIDER_CODE_TTL_SECONDS`          | Authorization code TTL (default 300)                               |
| `OIDC_PROVIDER_ACCESS_TOKEN_TTL_SECONDS`  | Access token TTL (default 3600)                                    |

## Auth0 setup (custom social connection)

1. In Auth0: Authentication → Social → Create Connection → Create Custom.
2. Configure:
   - **Purpose**: Authentication
   - **Name**: `siwe` (or similar)
   - **Authorization URL**: `https://<CGW_HOST>/v1/oauth2/authorize`
   - **Token URL**: `https://<CGW_HOST>/v1/oauth2/token`
   - **Scope**: `openid`
   - **Client ID / Client Secret**: the values from `OIDC_PROVIDER_CLIENT_ID` / `OIDC_PROVIDER_CLIENT_SECRET`
3. **Fetch User Profile Script**:

   ```js
   function fetchUserProfile(accessToken, context, callback) {
     request.get(
       {
         url: 'https://<CGW_HOST>/v1/oauth2/userinfo',
         headers: { Authorization: 'Bearer ' + accessToken },
       },
       (err, resp, body) => {
         if (err) return callback(err);
         if (resp.statusCode !== 200) {
           return callback(new Error(body));
         }
         const profile = JSON.parse(body);
         callback(null, {
           user_id: profile.sub,
           nickname: profile.preferred_username,
         });
       },
     );
   }
   ```

4. Add `https://<AUTH0_TENANT>/login/callback` to `OIDC_PROVIDER_REDIRECT_URIS`.
