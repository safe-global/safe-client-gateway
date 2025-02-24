import {
  BadGatewayException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { recoverAddress, isAddressEqual, recoverMessageAddress } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { getSafeTxHash } from '@/domain/common/utils/safe';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { ProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';
import { IDelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository.interface';

@Injectable()
export class TransactionVerifierHelper {
  private readonly isApiHashVerificationEnabled: boolean;
  private readonly isApiSignatureVerificationEnabled: boolean;

  private readonly isProposalHashVerificationEnabled: boolean;
  private readonly isProposalSignatureVerificationEnabled: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IDelegatesV2Repository)
    private readonly delegatesV2Repository: IDelegatesV2Repository,
  ) {
    this.isApiHashVerificationEnabled = this.configurationService.getOrThrow(
      'features.hashVerification.api',
    );
    this.isApiSignatureVerificationEnabled =
      this.configurationService.getOrThrow(
        'features.signatureVerification.api',
      );
    this.isProposalHashVerificationEnabled =
      this.configurationService.getOrThrow(
        'features.hashVerification.proposal',
      );
    this.isProposalSignatureVerificationEnabled =
      this.configurationService.getOrThrow(
        'features.signatureVerification.proposal',
      );
  }

  public async verifyApiTransaction(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
  }): Promise<void> {
    if (this.isApiHashVerificationEnabled) {
      this.verifyApiSafeTxHash(args);
    }
    if (this.isApiSignatureVerificationEnabled) {
      await this.verifyApiSignatures(args);
    }
  }

  private async verifyApiSignatures(args: {
    safe: Safe;
    transaction: MultisigTransaction;
  }): Promise<void> {
    if (
      !args.transaction.confirmations ||
      args.transaction.confirmations.length === 0
    ) {
      return;
    }

    const uniqueOwners = new Set(
      args.transaction.confirmations.map((c) => c.owner),
    );
    if (uniqueOwners.size !== args.transaction.confirmations.length) {
      throw new BadGatewayException('Duplicate owners');
    }

    const uniqueSignatures = new Set(
      args.transaction.confirmations.map((c) => c.signature),
    );
    if (uniqueSignatures.size !== args.transaction.confirmations.length) {
      throw new BadGatewayException('Duplicate signatures');
    }

    for (const confirmation of args.transaction.confirmations) {
      if (!confirmation.signature) {
        continue;
      }

      const rAndS = confirmation.signature.slice(0, -2) as `0x${string}`;
      const v = parseInt(confirmation.signature.slice(-2), 16);

      switch (confirmation.signatureType) {
        // v = 1, approved on chain
        case SignatureType.ApprovedHash: {
          continue;
        }

        // v = 0, requires on-chain verification
        case SignatureType.ContractSignature: {
          continue;
        }

        case SignatureType.Eoa: {
          if (v !== 27 && v !== 28) {
            throw new BadGatewayException(
              `${SignatureType.Eoa} signature must have v equal to 27 or 28`,
            );
          }

          let address: `0x${string}`;
          try {
            address = await recoverAddress({
              hash: args.transaction.safeTxHash,
              signature: confirmation.signature,
            });
          } catch {
            throw new BadGatewayException(
              `Could not recover ${SignatureType.Eoa} address`,
            );
          }

          // We don't check against Safe owners as ownership may have since changed
          if (!isAddressEqual(address, confirmation.owner)) {
            throw new BadGatewayException('Invalid EOA signature');
          }

          break;
        }

        case SignatureType.EthSign: {
          if (v !== 31 && v !== 32) {
            throw new BadGatewayException(
              `${SignatureType.EthSign} signature must have v equal to 31 or 32`,
            );
          }

          // Undo v adjustment for eth_sign
          // @see https://docs.safe.global/advanced/smart-account-signatures#eth_sign-signature
          const signature = (rAndS + (v - 4).toString(16)) as `0x${string}`;

          let address: `0x${string}`;
          try {
            address = await recoverMessageAddress({
              message: {
                raw: args.transaction.safeTxHash,
              },
              signature,
            });
          } catch {
            throw new BadGatewayException(
              `Could not recover ${SignatureType.EthSign} address`,
            );
          }

          // We don't check against Safe owners as ownership may have since changed
          if (!isAddressEqual(address, confirmation.owner)) {
            throw new BadGatewayException(
              `Invalid ${SignatureType.EthSign} signature`,
            );
          }

          break;
        }

        default: {
          throw new BadGatewayException('Invalid signature type');
        }
      }
    }
  }

  private verifyApiSafeTxHash(args: {
    chainId: string;
    transaction: MultisigTransaction;
    safe: Safe;
  }): void {
    let safeTxHash: `0x${string}`;
    try {
      safeTxHash = getSafeTxHash(args);
    } catch {
      throw new BadGatewayException('Could not calculate safeTxHash');
    }

    if (safeTxHash !== args.transaction.safeTxHash) {
      throw new BadGatewayException('Invalid safeTxHash');
    }
  }

  // TODO: Refactor with the above

  public async verifyProposal(args: {
    chainId: string;
    safe: Safe;
    proposal: ProposeTransactionDto;
  }): Promise<void> {
    if (this.isProposalHashVerificationEnabled) {
      this.verifyProposalSafeTxHash(args);
    }
    if (this.isProposalSignatureVerificationEnabled) {
      await this.verifyProposalSignature(args);
    }
  }

  private async verifyProposalSignature(args: {
    chainId: string;
    safe: Safe;
    proposal: ProposeTransactionDto;
  }): Promise<void> {
    const SIGNATURE_LENGTH = 130;

    if (!args.proposal.signature) {
      return;
    }

    // Clients may propose concatenated signatures so we need to split them
    const signatures: Array<`0x${string}`> = [];

    // TODO: Iterate on this to take compressed/dynamic parts into account
    for (let i = 2; i < args.proposal.signature.length; i += SIGNATURE_LENGTH) {
      const signature: `0x${string}` = `0x${args.proposal.signature.slice(i, i + SIGNATURE_LENGTH)}`;
      signatures.push(signature);
    }

    const recoveredAddresses = await Promise.all(
      signatures.map(async (signature) => {
        const rAndS = signature.slice(0, -2) as `0x${string}`;
        const v = parseInt(signature.slice(-2), 16);

        const signatureType = ((): SignatureType => {
          if (v === 1) {
            return SignatureType.ApprovedHash;
          }
          if (v === 0) {
            return SignatureType.ContractSignature;
          }
          if (v === 27 || v === 28) {
            return SignatureType.Eoa;
          }
          if (v === 31 || v === 32) {
            return SignatureType.EthSign;
          }
          throw new UnprocessableEntityException('Invalid signature type');
        })();

        switch (signatureType) {
          case SignatureType.ApprovedHash:
          case SignatureType.ContractSignature: {
            return null;
          }

          case SignatureType.Eoa: {
            try {
              return await recoverAddress({
                hash: args.proposal.safeTxHash,
                signature,
              });
            } catch {
              throw new UnprocessableEntityException(
                `Could not recover ${SignatureType.Eoa} address`,
              );
            }
          }

          case SignatureType.EthSign: {
            // Undo v adjustment for eth_sign
            // @see https://docs.safe.global/advanced/smart-account-signatures#eth_sign-signature
            const signature = (rAndS + (v - 4).toString(16)) as `0x${string}`;

            try {
              return await recoverMessageAddress({
                message: {
                  raw: args.proposal.safeTxHash,
                },
                signature,
              });
            } catch {
              throw new UnprocessableEntityException(
                `Could not recover ${SignatureType.EthSign} address`,
              );
            }
          }

          default: {
            throw new UnprocessableEntityException('Invalid signature type');
          }
        }
      }),
    );

    if (!recoveredAddresses.includes(args.proposal.sender)) {
      const couldNotRecover = recoveredAddresses.some((address) => {
        return address === null;
      });
      if (!couldNotRecover) {
        throw new UnprocessableEntityException('Invalid signature');
      }
    }

    if (!args.safe.owners.includes(args.proposal.sender)) {
      const delegates = await this.delegatesV2Repository.getDelegates({
        chainId: args.chainId,
        safeAddress: args.safe.address,
      });
      if (!delegates.results.some((d) => d.delegate === args.proposal.sender)) {
        throw new UnprocessableEntityException('Invalid signature');
      }
    }
  }

  private verifyProposalSafeTxHash(args: {
    chainId: string;
    safe: Safe;
    proposal: ProposeTransactionDto;
  }): void {
    let safeTxHash: `0x${string}`;
    try {
      safeTxHash = getSafeTxHash({
        chainId: args.chainId,
        transaction: {
          ...args.proposal,
          nonce: Number(args.proposal.nonce),
          safeTxGas: Number(args.proposal.safeTxGas),
          baseGas: Number(args.proposal.baseGas),
        },
        safe: args.safe,
      });
    } catch {
      throw new UnprocessableEntityException('Could not calculate safeTxHash');
    }

    if (safeTxHash !== args.proposal.safeTxHash) {
      throw new UnprocessableEntityException('Invalid safeTxHash');
    }
  }
}
