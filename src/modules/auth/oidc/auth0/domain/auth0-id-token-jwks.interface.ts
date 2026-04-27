// SPDX-License-Identifier: FSL-1.1-MIT
import type { JWTVerifyGetKey } from 'jose';

export const IAuth0IdTokenJwks = Symbol('IAuth0IdTokenJwks');

export type IAuth0IdTokenJwks = JWTVerifyGetKey;
