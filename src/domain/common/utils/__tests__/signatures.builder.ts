import { faker } from '@faker-js/faker';
import { isAddress, type PrivateKeyAccount } from 'viem';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH } from '@/domain/common/utils/signatures';

export async function getSignature(args: {
  signer: PrivateKeyAccount;
  hash: `0x${string}`;
  signatureType: SignatureType;
}): Promise<`0x${string}`> {
  switch (args.signatureType) {
    case SignatureType.ContractSignature: {
      return getContractSignature(args.signer.address);
    }
    case SignatureType.ApprovedHash: {
      return getApprovedHashSignature(args.signer.address);
    }
    case SignatureType.Eoa: {
      return await getEoaSignature({ signer: args.signer, hash: args.hash });
    }
    case SignatureType.EthSign: {
      return await getEthSignSignature({
        signer: args.signer,
        hash: args.hash,
      });
    }
    default: {
      throw new Error(`Unknown signature type: ${args.signatureType}`);
    }
  }
}

export function getApprovedHashSignature(owner: `0x${string}`): `0x${string}` {
  return ('0x000000000000000000000000' +
    owner.slice(2) +
    '0000000000000000000000000000000000000000000000000000000000000000' +
    '01') as `0x${string}`;
}

/**
 * Builds a mock contract signature for a given owner, consisting of:
 *  - A static part: a padded verifier address, data pointer, and signature type
 *  - A dynamic part: a 32-byte length field followed by padded random hex data
 *
 * @param verifier - the verifier address as a 0x-prefixed hex string
 * @returns a mock contract signature as a lower-cased hex string
 */
export function getContractSignature(verifier: `0x${string}`): `0x${string}` {
  // For single-signature blob, the pointer is 65, left-padded to 32 bytes
  const DATA_POINTER = (65).toString(16).padStart(64, '0');
  const CONTRACT_SIGNATURE_TYPE = '00';

  if (!isAddress(verifier)) {
    throw new Error('Invalid verifier address');
  }

  // Verifier padded to 32 bytes
  const paddedVerifier = verifier.slice(2).padStart(64, '0');
  const staticPart = paddedVerifier + DATA_POINTER + CONTRACT_SIGNATURE_TYPE;

  const byteLength = faker.number.int({ min: 1, max: 10 });

  const lengthFieldHex = byteLength
    .toString(16)
    .padStart(DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH, '0');

  const dynamicPartHex = faker.string
    .hexadecimal({ length: byteLength * 2 })
    .slice(2);

  const dynamicPart = lengthFieldHex + dynamicPartHex;

  return `0x${(staticPart + dynamicPart).toLowerCase()}`;
}

export async function getEoaSignature(args: {
  signer: PrivateKeyAccount;
  hash: `0x${string}`;
}): Promise<`0x${string}`> {
  return await args.signer.sign({ hash: args.hash });
}

export async function getEthSignSignature(args: {
  signer: PrivateKeyAccount;
  hash: `0x${string}`;
}): Promise<`0x${string}`> {
  const signature = await args.signer.signMessage({
    message: { raw: args.hash },
  });

  // To differentiate signature types, eth_sign signatures have v value increased by 4
  // @see https://docs.safe.global/advanced/smart-account-signatures#eth_sign-signature
  const v = parseInt(signature.slice(-2), 16);
  return (signature.slice(0, 130) + (v + 4).toString(16)) as `0x${string}`;
}
