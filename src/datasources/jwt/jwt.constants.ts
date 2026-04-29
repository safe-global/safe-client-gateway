// SPDX-License-Identifier: FSL-1.1-MIT

export const JWT_HS_ALGORITHM = 'HS256' as const;
// Keep this library-agnostic: Auth0 ID-token verification uses jose, while tests use jsonwebtoken.
export const JWT_RS_ALGORITHM = 'RS256' as const;
