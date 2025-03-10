import { HexBytesSchema } from '@/validation/entities/schemas/hexbytes.schema';

// This does not take dynamic parts into account but we can safely
// apply it to proposed signatures as we do not support contract
// signatures in the inferface
function isSignature(value: `0x${string}`): boolean {
  // We accept proposals of singular or concatenated signatures
  return (value.length - 2) % 130 === 0;
}

export const SignatureSchema = HexBytesSchema.refine(isSignature, {
  message: 'Invalid signature',
});
