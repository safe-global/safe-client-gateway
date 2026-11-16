// SPDX-License-Identifier: FSL-1.1-MIT
import { secp256k1 } from '@noble/curves/secp256k1';
import { type Address, getAddress, type Hex, hashMessage } from 'viem';
import { publicKeyToAddress } from 'viem/utils';
import { SignatureType } from '#/domain/common/entities/signature-type.entity';
import { LruMap } from '#/domain/common/utils/lru-map';
import {
  parseSignaturesByType,
  R_OR_S_HEX_LENGTH,
  SIGNATURE_HEX_LENGTH,
  V_HEX_LENGTH,
} from '#/domain/common/utils/signatures';
import {
  ADDRESS_LENGTH,
  HEX_BYTES_LENGTH,
  HEX_PREFIX_LENGTH,
} from '#/routes/common/constants';

const ETH_SIGN_V_OFFSET = 4;
const HASH_HEX_LENGTH = 32 * HEX_BYTES_LENGTH; // 32 bytes in hex

// A 0x-prefixed ECDSA signature followed by a 0x-prefixed hash
const RECOVERED_ADDRESS_KEY_LENGTH =
  HEX_PREFIX_LENGTH +
  SIGNATURE_HEX_LENGTH +
  HEX_PREFIX_LENGTH +
  HASH_HEX_LENGTH;

const MAX_RECOVERED_ADDRESSES = 50_000;

/**
 * The addresses recovered from ECDSA signatures, by signature and hash.
 *
 * Shared by every {@link SafeSignature}, as an instance does not outlive the
 * request that verifies it.
 */
const recoveredAddresses = new LruMap<string, Address>(MAX_RECOVERED_ADDRESSES);

export class SafeSignature {
  public signature: Hex;
  public hash: Hex;

  constructor(args: { signature: Hex; hash: Hex }) {
    const signatures = parseSignaturesByType(args.signature);

    if (signatures.length !== 1) {
      throw new Error('Concatenated signatures are not supported');
    }

    if (signatures[0] !== args.signature) {
      throw new Error('Invalid signature');
    }

    this.signature = args.signature;
    this.hash = args.hash;
  }

  get r(): Hex {
    return `0x${this.signature.slice(HEX_PREFIX_LENGTH, HEX_PREFIX_LENGTH + R_OR_S_HEX_LENGTH)}`;
  }

  get s(): Hex {
    const rOffset = HEX_PREFIX_LENGTH + R_OR_S_HEX_LENGTH;
    return `0x${this.signature.slice(rOffset, rOffset + R_OR_S_HEX_LENGTH)}`;
  }

  get v(): number {
    const vOffset = HEX_PREFIX_LENGTH + SIGNATURE_HEX_LENGTH - V_HEX_LENGTH;
    return Number.parseInt(
      this.signature.slice(vOffset, vOffset + V_HEX_LENGTH),
      16,
    );
  }

  get signatureType(): SignatureType {
    if (this.v === 0) {
      return SignatureType.ContractSignature;
    }
    if (this.v === 1) {
      return SignatureType.ApprovedHash;
    }
    if (this.v > 30) {
      return SignatureType.EthSign;
    }
    return SignatureType.Eoa;
  }

  get owner(): Address {
    try {
      return this.recoverOwner();
    } catch {
      throw new Error('Could not recover address');
    }
  }

  private recoverOwner(): Address {
    switch (this.signatureType) {
      case SignatureType.ContractSignature:
      case SignatureType.ApprovedHash: {
        return getAddress(`0x${this.r.slice(ADDRESS_LENGTH * -1)}`);
      }
      case SignatureType.EthSign: {
        // To differentiate signature types, eth_sign signatures have v value increased by 4
        // @see https://docs.safe.global/advanced/smart-account-signatures#eth_sign-signature
        const normalizedSignature: Hex = `${this.r}${this.s.slice(HEX_PREFIX_LENGTH)}${(this.v - ETH_SIGN_V_OFFSET).toString(16)}`;
        return recoverAddress({
          hash: hashMessage({ raw: this.hash }),
          signature: normalizedSignature,
        });
      }
      case SignatureType.Eoa: {
        return recoverAddress({
          hash: this.hash,
          signature: this.signature,
        });
      }
    }
  }
}

function recoverAddress(args: { hash: Hex; signature: Hex }): Address {
  const key = args.signature + args.hash;
  const memoized = recoveredAddresses.get(key);
  if (memoized) {
    return memoized;
  }

  const address = publicKeyToAddress(recoverPublicKey(args));

  // A hash of any length recovers an address, but only one of the expected
  // length keeps every entry, and with it the memo, at a known size
  if (key.length === RECOVERED_ADDRESS_KEY_LENGTH) {
    recoveredAddresses.set(key, address);
  }

  return address;
}

function recoverPublicKey(args: { hash: Hex; signature: Hex }): Hex {
  const recoveryBit = toRecoveryBit(args.signature);
  const signature = secp256k1.Signature.fromCompact(
    args.signature.substring(HEX_PREFIX_LENGTH, SIGNATURE_HEX_LENGTH),
  ).addRecoveryBit(recoveryBit);

  const publicKey = signature
    .recoverPublicKey(args.hash.substring(HEX_PREFIX_LENGTH))
    .toHex(false);

  return `0x${publicKey}`;
}

function toRecoveryBit(signature: Hex): number {
  const v = Number.parseInt(signature.slice(V_HEX_LENGTH * -1), 16);
  if (v === 0 || v === 1) {
    return v;
  }
  if (v === 27 || v === 28) {
    return v - 27;
  }
  throw new Error('Invalid v value');
}
