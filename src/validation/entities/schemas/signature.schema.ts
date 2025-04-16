import { SIGNATURE_HEX_LENGTH } from '@/domain/common/utils/signatures';
import { HexBytesSchema } from '@/validation/entities/schemas/hexbytes.schema';

function isSignatureLike(value: `0x${string}`): boolean {
  // We accept proposals of singular or concatenated signatures
  return value.length - 2 >= SIGNATURE_HEX_LENGTH;
}

export const SignatureSchema = HexBytesSchema.refine(isSignatureLike, {
  message: 'Invalid signature',
});
