const HEX_PREFIX_LENGTH = 2;
export const SIGNATURE_HEX_LENGTH = 65 * 2; // 65 bytes in hex
export const DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH = 64; // 32 bytes in hex

/**
 * Parses a (concatenated) signature string into individual signature types
 *
 * @param signature - A 0x-prefixed hex string of a (concatenated) signature
 * @returns An array of 0x-prefixed signature type signatures
 */
export function parseSignaturesByType(
  signature: `0x${string}`,
): Array<`0x${string}`> {
  if (!signature.startsWith('0x')) {
    throw new Error('Invalid "0x" notated signature');
  }

  if (signature.length % 2 !== 0) {
    throw new Error('Invalid hex bytes length');
  }

  if (signature.length < SIGNATURE_HEX_LENGTH + HEX_PREFIX_LENGTH) {
    throw new Error('Invalid signature length');
  }

  const signatures: Array<`0x${string}`> = [];

  let i = HEX_PREFIX_LENGTH;

  while (i < signature.length) {
    if (signature.length - i < SIGNATURE_HEX_LENGTH) {
      throw new Error('Insufficient length for static part');
    }

    const staticPart = signature.slice(i, i + SIGNATURE_HEX_LENGTH);
    const v = staticPart.slice(-2);

    const isContractSignature = v === '00';

    if (!isContractSignature) {
      signatures.push(`0x${staticPart}`);

      // Move to next signature
      i += SIGNATURE_HEX_LENGTH;
      continue;
    }

    // Verify presence of length field
    if (
      signature.length - i <
      SIGNATURE_HEX_LENGTH + DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH
    ) {
      throw new Error('Insufficient length for dynamic part length field');
    }

    const remainingHex = signature.slice(i + SIGNATURE_HEX_LENGTH);

    // Compute dynamic part length
    const lengthFieldHex = remainingHex.slice(
      0,
      DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH,
    );
    const byteLength = parseInt(lengthFieldHex, 16);

    // Dynamic data must be padded to 32 bytes
    const paddedByteLength = Math.ceil(byteLength / 32) * 32;

    const dynamicPartHexLength =
      DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH + paddedByteLength * 2;

    // Verify entire dynamic part is present
    if (signature.length - i < SIGNATURE_HEX_LENGTH + dynamicPartHexLength) {
      throw new Error('Insufficient length for dynamic part');
    }

    const dynamicPart = remainingHex.slice(0, dynamicPartHexLength);

    signatures.push(`0x${staticPart}${dynamicPart}`);

    // Move to next signature, skipping dynamic part
    i += SIGNATURE_HEX_LENGTH + dynamicPartHexLength;
  }

  return signatures;
}
