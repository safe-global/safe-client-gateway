import { SIGNATURE_HEX_LENGTH } from '@/domain/common/utils/signatures';
import { HEX_PREFIX_LENGTH } from '@/routes/common/constants';
import { HexBytesSchema } from '@/validation/entities/schemas/hexbytes.schema';

// We only validate the likeness of a signature, e.g. that it is at least
// an EOA but maybe a contract signature or an unknown concatenation of
// both as this schema is used for signatures in the queue/history.
// We only verify the integrity of signatures in the queue.
export function isSignatureLike(value: `0x${string}`): boolean {
  return value.length - HEX_PREFIX_LENGTH >= SIGNATURE_HEX_LENGTH;
}

export const SignatureSchema = HexBytesSchema.refine(isSignatureLike, {
  message: 'Invalid signature',
});
