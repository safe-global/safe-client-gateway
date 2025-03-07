import { HexSchema } from '@/validation/entities/schemas/hex.schema';

// This does not take dynamic parts into account but we can safely
// apply it to proposed signatures as we do not support contract
// signatures in the inferface
function isSignature(value: `0x${string}`): boolean {
  // We accept proposals of singular or concatenated signatures
  return (value.length - 2) % 130 === 0;
}

export const SignatureSchema = HexSchema.refine(isSignature, {
  message: 'Invalid signature',
});

// As indexed signatures may be contract signatures, we need to assume
// that signatures from our API may have a dynamic part meaning that
// we can only check that the length is "byte-aligned"
function isSignatureLike(value: `0x${string}`): boolean {
  return value.length % 2 === 0;
}

export const SignatureLikeSchema = HexSchema.refine(isSignatureLike, {
  message: 'Invalid signature',
});
