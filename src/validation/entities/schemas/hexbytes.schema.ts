import type { Address } from 'viem';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export function isHexBytes(value: Address): boolean {
  return value.length % 2 === 0;
}

export const HexBytesSchema = HexSchema.refine(isHexBytes, {
  error: 'Invalid hex bytes',
});
