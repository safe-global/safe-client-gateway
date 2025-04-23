import { HEX_BYTES_LENGTH, HEX_PREFIX_LENGTH } from '@/routes/common/constants';
import { isHexBytes } from '@/validation/entities/schemas/hexbytes.schema';
import { isSignatureLike } from '@/validation/entities/schemas/signature.schema';

export const R_OR_S_HEX_LENGTH = 32 * HEX_BYTES_LENGTH; // 32 bytes in hex
export const V_HEX_LENGTH = 1 * HEX_BYTES_LENGTH; // 1 byte in hex
export const SIGNATURE_HEX_LENGTH =
  R_OR_S_HEX_LENGTH + R_OR_S_HEX_LENGTH + V_HEX_LENGTH; // 65 bytes in hex
export const DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH = 32 * HEX_BYTES_LENGTH; // 32 bytes in hex

/**
 * Parses a (concatenated) signature string into individual signature types
 *
 * @param signature - A 0x-prefixed hex string of a (concatenated) signature
 * @returns An array of 0x-prefixed signature type signatures
 */
export function parseSignaturesByType(
  signature: `0x${string}`,
): Array<`0x${string}`> {
  // TODO: Replace with viem's isHex and update all tests accordingly
  if (!signature.startsWith('0x')) {
    throw new Error('Invalid "0x" notated signature');
  }

  if (!isHexBytes(signature)) {
    throw new Error('Invalid hex bytes length');
  }

  if (!isSignatureLike(signature)) {
    throw new Error('Invalid signature length');
  }

  const signatures: Array<`0x${string}`> = [];

  let i = HEX_PREFIX_LENGTH;

  while (i < signature.length) {
    if (signature.length - i < SIGNATURE_HEX_LENGTH) {
      throw new Error('Insufficient length for static part');
    }

    const staticPart = getStaticPart(signature, i);

    if (!isContractSignature(staticPart)) {
      signatures.push(`0x${staticPart}`);

      // Move to next signature
      i += SIGNATURE_HEX_LENGTH;
      continue;
    }

    const dynamicPart = getDynamicPart(signature, i);

    signatures.push(`0x${staticPart}${dynamicPart}`);

    // Move to next signature, skipping dynamic part
    i += SIGNATURE_HEX_LENGTH + dynamicPart.length;
  }

  return signatures;
}

function getStaticPart(signature: `0x${string}`, offset: number): string {
  return signature.slice(offset, offset + SIGNATURE_HEX_LENGTH);
}

function isContractSignature(staticPart: string): boolean {
  const v = staticPart.slice(V_HEX_LENGTH * -1);
  return v === '00';
}

function getDynamicPart(maybeDynamicPart: string, offset: number): string {
  if (!hasLengthField(maybeDynamicPart, offset)) {
    throw new Error('Insufficient length for dynamic part length field');
  }

  const remainingHex = maybeDynamicPart.slice(offset + SIGNATURE_HEX_LENGTH);
  const dynamicPartHexLength = getDynamicPartLength(remainingHex);
  const dynamicPart = remainingHex.slice(0, dynamicPartHexLength);

  // Verify entire dynamic part is present
  if (dynamicPart.length !== dynamicPartHexLength) {
    throw new Error('Insufficient length for dynamic part');
  }

  return dynamicPart;
}

function hasLengthField(maybeDynamicPart: string, offset: number): boolean {
  return (
    maybeDynamicPart.length - offset >=
    SIGNATURE_HEX_LENGTH + DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH
  );
}

function getDynamicPartLength(remainingHex: string): number {
  const lengthFieldHex = remainingHex.slice(
    0,
    DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH,
  );
  const byteLength = parseInt(lengthFieldHex, 16);
  return DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH + byteLength * HEX_BYTES_LENGTH;
}
