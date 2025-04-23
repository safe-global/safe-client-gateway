import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export function isHexBytes(value: `0x${string}`): boolean {
  return value.length % 2 === 0;
}

export const HexBytesSchema = HexSchema.refine(isHexBytes, {
  message: 'Invalid hex bytes',
});
