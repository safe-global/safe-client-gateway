import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import type { PrivateKeyAccount } from 'viem';

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

function getApprovedHashSignature(owner: `0x${string}`): `0x${string}` {
  return ('0x000000000000000000000000' +
    owner.slice(2) +
    '0000000000000000000000000000000000000000000000000000000000000000' +
    '01') as `0x${string}`;
}

function getContractSignature(owner: `0x${string}`): `0x${string}` {
  return ('0x000000000000000000000000' +
    owner.slice(2) +
    '0000000000000000000000000000000000000000000000000000000000000000' +
    '00') as `0x${string}`;
}

async function getEoaSignature(args: {
  signer: PrivateKeyAccount;
  hash: `0x${string}`;
}): Promise<`0x${string}`> {
  return await args.signer.sign({ hash: args.hash });
}

async function getEthSignSignature(args: {
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
