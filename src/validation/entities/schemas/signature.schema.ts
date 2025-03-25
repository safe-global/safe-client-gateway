import { parseSignaturesByType } from '@/domain/common/utils/signatures';
import { HexBytesSchema } from '@/validation/entities/schemas/hexbytes.schema';

function isSignature(value: `0x${string}`): boolean {
  try {
    parseSignaturesByType(value);
    return true;
  } catch {
    return false;
  }
}

export const SignatureSchema = HexBytesSchema.refine(isSignature, {
  message: 'Invalid signature',
});
