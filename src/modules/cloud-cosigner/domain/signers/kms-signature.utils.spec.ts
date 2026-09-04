// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { secp256k1 } from '@noble/curves/secp256k1';
import { type Hex, hexToBytes, keccak256, recoverAddress, toHex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  derToRs,
  normalizeS,
  spkiToAddress,
  toEoaSignature,
} from '@/modules/cloud-cosigner/domain/signers/kms-signature.utils';

// SubjectPublicKeyInfo header for an uncompressed secp256k1 point.
const SPKI_SECP256K1_HEADER = '3056301006072a8648ce3d020106052b8104000a034200';
const SECP256K1_N = BigInt(
  '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141',
);

function derInteger(value: bigint): string {
  let hex = value.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  // A leading 1-bit needs a zero pad to stay positive.
  if (Number.parseInt(hex.slice(0, 2), 16) >= 0x80) hex = `00${hex}`;
  const length = (hex.length / 2).toString(16).padStart(2, '0');
  return `02${length}${hex}`;
}

function toDer(r: bigint, s: bigint): Uint8Array {
  const body = `${derInteger(r)}${derInteger(s)}`;
  const length = (body.length / 2).toString(16).padStart(2, '0');
  return hexToBytes(`0x30${length}${body}`);
}

describe('kms-signature.utils', () => {
  describe('derToRs', () => {
    it('should split a DER sequence into r and s', () => {
      const r = BigInt(faker.string.hexadecimal({ length: 64 }));
      const s = BigInt(faker.string.hexadecimal({ length: 62 }));

      expect(derToRs(toDer(r, s))).toStrictEqual({ r, s });
    });

    it('should reject a buffer that is not a DER sequence', () => {
      expect(() => derToRs(hexToBytes('0x0203010203'))).toThrow(
        'Malformed DER signature',
      );
    });
  });

  describe('normalizeS', () => {
    it('should leave a low s untouched', () => {
      expect(normalizeS(1n)).toBe(1n);
    });

    it('should flip a high s into the lower half', () => {
      const high = SECP256K1_N - 1n;

      expect(normalizeS(high)).toBe(1n);
    });
  });

  describe('spkiToAddress', () => {
    it('should derive the address of the embedded uncompressed point', () => {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      const point = secp256k1.getPublicKey(hexToBytes(privateKey), false);
      const spki = hexToBytes(
        `0x${SPKI_SECP256K1_HEADER}${toHex(point).slice(2)}`,
      );

      expect(spkiToAddress(spki)).toBe(account.address);
    });

    it('should reject a compressed point', () => {
      const compressed = new Uint8Array(65).fill(0x02);

      expect(() => spkiToAddress(compressed)).toThrow(
        'not an uncompressed secp256k1 point',
      );
    });
  });

  describe('toEoaSignature', () => {
    it('should pick the recovery id that recovers the signer', async () => {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      const hash = keccak256(toHex(faker.string.alphanumeric(32)));
      // A raw (r, s) pair as KMS would return it: no recovery information.
      const raw = secp256k1.sign(hexToBytes(hash), hexToBytes(privateKey), {
        lowS: false,
      });

      const signature = await toEoaSignature({
        r: raw.r,
        s: raw.s,
        hash,
        expectedSigner: account.address,
      });

      expect(signature).toHaveLength(2 + 65 * 2);
      await expect(recoverAddress({ hash, signature })).resolves.toBe(
        account.address,
      );
      const v = Number.parseInt(signature.slice(-2), 16);
      expect([27, 28]).toContain(v);
    });

    it('should reject an (r, s) pair that belongs to another key', async () => {
      const hash = keccak256(toHex(faker.string.alphanumeric(32)));
      const raw = secp256k1.sign(
        hexToBytes(hash),
        hexToBytes(generatePrivateKey()),
      );
      const other = privateKeyToAccount(generatePrivateKey());

      await expect(
        toEoaSignature({
          r: raw.r,
          s: raw.s,
          hash: hash as Hex,
          expectedSigner: other.address,
        }),
      ).rejects.toThrow('does not recover to the cosigner address');
    });
  });
});
