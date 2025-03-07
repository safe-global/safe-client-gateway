import { HexSchema } from '@/validation/entities/schemas/hex.schema';

function isSignature(value: `0x${string}`): boolean {
  // We accept proposals of singular or concatenated signatures
  return (value.length - 2) % 130 === 0;
}

export const SignatureSchema = HexSchema.refine(isSignature, {
  message: 'Invalid signature',
});
