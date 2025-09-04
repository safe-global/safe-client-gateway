import type { UUID } from 'crypto';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Address } from 'viem';

export async function safeRegistrationSignatureBuilder(args: {
  signaturePrefix: string;
  uuid: UUID;
  cloudMessagingToken: UUID;
  timestamp: number;
  safeAddresses: Array<Address>;
}): Promise<string> {
  const privateKey = generatePrivateKey();
  const signer = privateKeyToAccount(privateKey);
  return await signer.signMessage({
    message: `${args.signaturePrefix}${args.timestamp}${args.uuid}${args.cloudMessagingToken}${args.safeAddresses.sort().join('')}`,
  });
}
