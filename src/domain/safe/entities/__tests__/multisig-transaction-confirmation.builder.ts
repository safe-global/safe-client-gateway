import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Confirmation } from '@/domain/safe/entities/multisig-transaction.entity';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { getAddress } from 'viem';

const HASH_LENGTH = 64;
const SIGNATURE_LENGTH = 130;

export function approvedHashConfirmationBuilder(): IBuilder<Confirmation> {
  return new Builder<Confirmation>()
    .with('owner', getAddress(faker.finance.ethereumAddress()))
    .with(
      'signature',
      faker.string.hexadecimal({ length: SIGNATURE_LENGTH }) as `0x${string}`,
    )
    .with('signatureType', SignatureType.ApprovedHash)
    .with('submissionDate', faker.date.recent())
    .with(
      'transactionHash',
      faker.string.hexadecimal({ length: HASH_LENGTH }) as `0x${string}`,
    );
}

export function contractSignatureConfirmationBuilder(): IBuilder<Confirmation> {
  return new Builder<Confirmation>()
    .with('owner', getAddress(faker.finance.ethereumAddress()))
    .with(
      'signature',
      faker.string.hexadecimal({ length: SIGNATURE_LENGTH }) as `0x${string}`,
    )
    .with('signatureType', SignatureType.ContractSignature)
    .with('submissionDate', faker.date.recent())
    .with(
      'transactionHash',
      faker.string.hexadecimal({ length: HASH_LENGTH }) as `0x${string}`,
    );
}

export async function ethSignConfirmationBuilder(
  safeTxHash: `0x${string}`,
): Promise<IBuilder<Confirmation>> {
  const privateKey = generatePrivateKey();
  const signer = privateKeyToAccount(privateKey);
  const signature = await signer.signMessage({ message: { raw: safeTxHash } });

  const rAndS = signature.slice(0, 130);
  const v = parseInt(signature.slice(-2), 16);

  // Adjust v for eth_sign
  // @see https://docs.safe.global/advanced/smart-account-signatures#eth_sign-signature
  const adjustedV = v + 4;
  const adjustedSignature = (rAndS + adjustedV.toString(16)) as `0x${string}`;

  return new Builder<Confirmation>()
    .with('owner', signer.address)
    .with('signature', adjustedSignature)
    .with('signatureType', SignatureType.EthSign)
    .with('submissionDate', faker.date.recent())
    .with('transactionHash', null);
}

export async function eoaConfirmationBuilder(
  safeTxHash: `0x${string}`,
): Promise<IBuilder<Confirmation>> {
  const privateKey = generatePrivateKey();
  const signer = privateKeyToAccount(privateKey);
  const signature = await signer.sign({ hash: safeTxHash });
  return new Builder<Confirmation>()
    .with('owner', signer.address)
    .with('signature', signature)
    .with('signatureType', SignatureType.Eoa)
    .with('submissionDate', faker.date.recent())
    .with('transactionHash', null);
}

export async function confirmationBuilder(
  safeTxHash?: `0x${string}`,
): Promise<IBuilder<Confirmation>> {
  if (safeTxHash) {
    return faker.helpers.arrayElement([
      await ethSignConfirmationBuilder(safeTxHash),
      await eoaConfirmationBuilder(safeTxHash),
    ]);
  } else {
    return faker.helpers.arrayElement([
      approvedHashConfirmationBuilder(),
      contractSignatureConfirmationBuilder(),
    ]);
  }
}

export function toJson(confirmation: Confirmation): unknown {
  return {
    ...confirmation,
    submissionDate: confirmation.submissionDate.toISOString(),
  };
}
