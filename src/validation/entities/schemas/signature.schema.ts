// SPDX-License-Identifier: FSL-1.1-MIT
import {
  HEX_BYTES_LENGTH,
  HEX_PREFIX_LENGTH,
} from '@/routes/common/constants';
import { HexBytesSchema } from '@/validation/entities/schemas/hexbytes.schema';
import type { Hex } from 'viem';

export const R_OR_S_HEX_LENGTH = 32 * HEX_BYTES_LENGTH; // 32 bytes in hex
export const V_HEX_LENGTH = 1 * HEX_BYTES_LENGTH; // 1 byte in hex
export const SIGNATURE_HEX_LENGTH =
  R_OR_S_HEX_LENGTH + R_OR_S_HEX_LENGTH + V_HEX_LENGTH; // 65 bytes in hex
export const DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH =
  32 * HEX_BYTES_LENGTH; // 32 bytes in hex

// We only validate the likeness of a signature, e.g. that it is at least
// an EOA but maybe a contract signature or an unknown concatenation of
// both as this schema is used for signatures in the queue/history.
// We only verify the integrity of signatures in the queue.
export function isSignatureLike(value: Hex): boolean {
  return value.length - HEX_PREFIX_LENGTH >= SIGNATURE_HEX_LENGTH;
}

export const SignatureSchema = HexBytesSchema.refine(isSignatureLike, {
  error: 'Invalid signature',
});
