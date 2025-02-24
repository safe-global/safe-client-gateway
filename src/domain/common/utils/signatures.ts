import { SignatureType } from '@/domain/common/entities/signature-type.entity';

const R_LENGTH = 64;
const S_LENGTH = 64;
const V_LENGTH = 2;
const SIGNATURE_LENGTH = R_LENGTH + S_LENGTH + V_LENGTH;

const ETH_SIGN_V_ADJUSTMENT = 4;

export type Signature = {
  r: `0x${string}`;
  s: `0x${string}`;
  v: number;
};

export function splitSignature(signature: string): Signature {
  if (signature.startsWith('0x')) {
    signature = signature.slice(2);
  }

  if (signature.length !== SIGNATURE_LENGTH) {
    throw new Error('Invalid signature length');
  }

  return {
    r: `0x${signature.slice(0, R_LENGTH)}`,
    s: `0x${signature.slice(R_LENGTH, R_LENGTH + S_LENGTH)}`,
    v: parseInt(signature.slice(-1 * V_LENGTH), 16),
  };
}

export function splitConcatenatedSignatures(
  string: string,
): Array<`0x${string}`> {
  if (string.startsWith('0x')) {
    string = string.slice(2);
  }

  if (string.length % SIGNATURE_LENGTH !== 0) {
    throw new Error('Invalid signatures length');
  }

  const signatures: Array<`0x${string}`> = [];

  for (let i = 0; i < string.length; i += SIGNATURE_LENGTH) {
    signatures.push(`0x${string.slice(i, i + SIGNATURE_LENGTH)}`);
  }

  return signatures;
}

export function normalizeEthSignSignature(
  signature: `0x${string}`,
): `0x${string}` {
  const { r, s, v } = splitSignature(signature);

  if (!isEthSignV(v)) {
    throw new Error(`Invalid ${SignatureType.EthSign} signature`);
  }

  return `0x${r.slice(2)}${s.slice(2)}${(v - ETH_SIGN_V_ADJUSTMENT).toString(16)}`;
}

export function isApprovedHashV(v: Signature['v']): boolean {
  return v === 1;
}

export function isContractSignatureV(v: Signature['v']): boolean {
  return v === 0;
}

export function isEoaV(v: Signature['v']): boolean {
  return v === 27 || v === 28;
}

export function isEthSignV(v: Signature['v']): boolean {
  return v === 31 || v === 32;
}
