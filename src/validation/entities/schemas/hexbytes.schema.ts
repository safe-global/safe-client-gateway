import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import type { Address } from 'viem';

export function isHexBytes(value: Address): boolean {
  return value.length % 2 === 0;
}

export const HexBytesSchema = HexSchema.refine(isHexBytes, {
  message: 'Invalid hex bytes',
});
