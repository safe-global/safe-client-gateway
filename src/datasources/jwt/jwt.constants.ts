// SPDX-License-Identifier: FSL-1.1-MIT

export const JWT_HS_ALGORITHM = 'HS256' as const;
// Keep this library-agnostic: Auth0 ID-token verification uses jose, while tests use jsonwebtoken.
export const JWT_RS_ALGORITHM = 'RS256' as const;
// ECDSA P-256 (asymmetric): private key signs, public key verifies.
// Used for the billing-service webhook service-to-service token.
export const JWT_ES_ALGORITHM = 'ES256' as const;
