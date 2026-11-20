// SPDX-License-Identifier: FSL-1.1-MIT
import type { HttpStatus } from '@nestjs/common';
import type { Hash, Hex } from 'viem';
import { SafeSignature } from '#/domain/common/entities/safe-signature';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';

/**
 * Builds a {@link SafeSignature} and recovers its (lazy) owner.
 * @throws {HttpExceptionNoLog} if the signature is malformed
 */
export function getSafeSignature(args: {
  signature: Hex;
  hash: Hash;
  code: HttpStatus;
}): SafeSignature {
  try {
    const signature = new SafeSignature(args);
    signature.owner;
    return signature;
  } catch {
    throw new HttpExceptionNoLog('Invalid signature', args.code);
  }
}
