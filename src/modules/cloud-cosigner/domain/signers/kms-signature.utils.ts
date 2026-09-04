// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type Address,
  type Hex,
  numberToHex,
  recoverAddress,
  serializeSignature,
  toHex,
} from 'viem';
import { publicKeyToAddress } from 'viem/utils';

const SECP256K1_N = BigInt(
  '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141',
);
const HALF_N = SECP256K1_N / 2n;
const UNCOMPRESSED_PUBLIC_KEY_LENGTH = 65;
const UNCOMPRESSED_PREFIX = 0x04;
const DER_SEQUENCE = 0x30;
const DER_INTEGER = 0x02;
const EOA_V_VALUES = [27, 28] as const;
const SCALAR_BYTES = 32;
const DER_LONG_FORM = 0x80;
const BITS_PER_BYTE = 8;

/**
 * Splits a DER-encoded ECDSA signature (`SEQUENCE { INTEGER r, INTEGER s }`)
 * as returned by KMS into its scalars.
 */
export function derToRs(der: Uint8Array): { r: bigint; s: bigint } {
  let offset = 0;
  const expect = (tag: number): number => {
    if (der[offset] !== tag) {
      throw new Error(`Malformed DER signature: expected tag ${tag}`);
    }
    offset += 1;
    let length = der[offset];
    offset += 1;
    if (length > DER_LONG_FORM) {
      const lengthBytes = length - DER_LONG_FORM;
      length = 0;
      for (let i = 0; i < lengthBytes; i++) {
        length = (length << BITS_PER_BYTE) | der[offset];
        offset += 1;
      }
    }
    return length;
  };
  const readInteger = (): bigint => {
    const length = expect(DER_INTEGER);
    const bytes = der.slice(offset, offset + length);
    offset += length;
    return BigInt(toHex(bytes));
  };

  expect(DER_SEQUENCE);
  const r = readInteger();
  const s = readInteger();
  return { r, s };
}

/**
 * Ethereum (and Safe's signature checker) reject high-s signatures, whereas
 * KMS may return either half. Flipping `s` keeps the signature valid for the
 * same key with the opposite recovery id.
 */
export function normalizeS(s: bigint): bigint {
  return s > HALF_N ? SECP256K1_N - s : s;
}

/**
 * Derives the address from the SPKI DER public key KMS returns: the
 * uncompressed secp256k1 point is its trailing 65 bytes.
 */
export function spkiToAddress(spki: Uint8Array): Address {
  const point = spki.slice(spki.length - UNCOMPRESSED_PUBLIC_KEY_LENGTH);
  if (point[0] !== UNCOMPRESSED_PREFIX) {
    throw new Error('KMS public key is not an uncompressed secp256k1 point');
  }
  return publicKeyToAddress(toHex(point));
}

/**
 * Assembles the `r || s || v` signature, choosing the recovery id that
 * recovers `expectedSigner`.
 */
export async function toEoaSignature(args: {
  r: bigint;
  s: bigint;
  hash: Hex;
  expectedSigner: Address;
}): Promise<Hex> {
  const s = normalizeS(args.s);
  for (const v of EOA_V_VALUES) {
    const signature = serializeSignature({
      r: numberToHex(args.r, { size: SCALAR_BYTES }),
      s: numberToHex(s, { size: SCALAR_BYTES }),
      v: BigInt(v),
    });
    const recovered = await recoverAddress({ hash: args.hash, signature });
    if (recovered.toLowerCase() === args.expectedSigner.toLowerCase()) {
      return signature;
    }
  }
  throw new Error('KMS signature does not recover to the cosigner address');
}
