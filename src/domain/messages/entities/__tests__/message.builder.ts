import { faker } from '@faker-js/faker';
import { Builder } from '@/__tests__/builder';
import type { Message } from '@/domain/messages/entities/message.entity';
import {
  messageConfirmationBuilder,
  toJson as messageConfirmationToJson,
} from '@/domain/messages/entities/__tests__/message-confirmation.builder';
import { getAddress, type PrivateKeyAccount } from 'viem';
import { fakeJson } from '@/__tests__/faker';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { getSafeMessageMessageHash } from '@/domain/common/utils/safe';
import {
  getContractSignature,
  getApprovedHashSignature,
  adjustEthSignSignature,
} from '@/domain/common/utils/__tests__/signatures.builder';
import type { Safe } from '@/domain/safe/entities/safe.entity';
import type { MessageConfirmation } from '@/domain/messages/entities/message-confirmation.entity';

class BuilderWithConfirmations<T extends Message> extends Builder<T> {
  public async buildWithConfirmations(args: {
    chainId: string;
    safe: Safe;
    signers: Array<PrivateKeyAccount>;
    signatureType?: SignatureType;
  }): Promise<T> {
    const areAllOwners = args.signers.every((signer) => {
      return args.safe.owners.includes(signer.address);
    });

    if (!areAllOwners) {
      throw new Error('All signers must be owners of the Safe');
    }

    const message = this.build();

    if (args.safe.address !== message.safe) {
      throw new Error('Safe address does not match');
    }

    message.messageHash = getSafeMessageMessageHash({
      ...args,
      message: message.message,
    });

    message.confirmations = await Promise.all(
      args.signers.map(async (signer): Promise<MessageConfirmation> => {
        const signatureType: SignatureType =
          args.signatureType ?? faker.helpers.enumValue(SignatureType);

        let signature: `0x${string}`;

        // TODO: Refactor with multisig BuilderWithConfirmations
        if (signatureType === SignatureType.ContractSignature) {
          signature = getContractSignature(signer.address);
        } else if (signatureType === SignatureType.ApprovedHash) {
          signature = getApprovedHashSignature(signer.address);
        } else if (signatureType === SignatureType.Eoa) {
          signature = await signer.sign({ hash: message.messageHash });
        } else if (SignatureType.EthSign) {
          signature = await signer
            .signMessage({ message: { raw: message.messageHash } })
            .then(adjustEthSignSignature);
        } else {
          throw new Error(`Unknown signature type: ${signatureType}`);
        }

        return {
          owner: signer.address,
          signature,
          signatureType,
          modified: faker.date.recent(),
          created: faker.date.past(),
        };
      }),
    );

    return message;
  }
}

export function messageBuilder(): BuilderWithConfirmations<Message> {
  return new BuilderWithConfirmations<Message>()
    .with('created', faker.date.recent())
    .with('modified', faker.date.recent())
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('message', faker.word.words({ count: { min: 1, max: 5 } }))
    .with(
      'messageHash',
      faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
    )
    .with('proposedBy', getAddress(faker.finance.ethereumAddress()))
    .with('safeAppId', faker.number.int())
    .with(
      'confirmations',
      faker.helpers.multiple(() => messageConfirmationBuilder().build(), {
        count: { min: 2, max: 5 },
      }),
    )
    .with(
      'preparedSignature',
      faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
    )
    .with('origin', fakeJson());
}

export function toJson(message: Message): unknown {
  return {
    ...message,
    created: message.created.toISOString(),
    modified: message.modified.toISOString(),
    confirmations: message?.confirmations.map((confirmation) =>
      messageConfirmationToJson(confirmation),
    ),
  };
}
