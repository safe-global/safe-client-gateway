import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { recoverAddress, isAddressEqual, recoverMessageAddress } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { getSafeTxHash } from '@/domain/common/utils/safe';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';

@Injectable()
export class TransactionVerifierHelper {
  private readonly isHashVerificationEnabled: boolean;
  private readonly isSignatureVerificationEnabled: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isHashVerificationEnabled = this.configurationService.getOrThrow(
      'features.hashVerification',
    );
    this.isSignatureVerificationEnabled = this.configurationService.getOrThrow(
      'features.signatureVerification',
    );
  }

  public async verifyTransaction(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
  }): Promise<void> {
    if (this.isHashVerificationEnabled) {
      this.verifySafeTxHash(args);
    }
    if (this.isSignatureVerificationEnabled) {
      await this.verifySignatures(args.transaction);
    }
  }

  private async verifySignatures(
    transaction: MultisigTransaction,
  ): Promise<void> {
    if (!transaction.confirmations || transaction.confirmations.length === 0) {
      return;
    }

    const uniqueOwners = new Set(transaction.confirmations.map((c) => c.owner));
    if (uniqueOwners.size !== transaction.confirmations.length) {
      throw new BadGatewayException('Duplicate owners');
    }

    const uniqueSignatures = new Set(
      transaction.confirmations.map((c) => c.signature),
    );
    if (uniqueSignatures.size !== transaction.confirmations.length) {
      throw new BadGatewayException('Duplicate signatures');
    }

    for (const confirmation of transaction.confirmations) {
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
              hash: transaction.safeTxHash,
              signature: confirmation.signature,
            });
          } catch {
            throw new BadGatewayException(
              `Could not recover ${SignatureType.Eoa} address`,
            );
          }

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
                raw: transaction.safeTxHash,
              },
              signature,
            });
          } catch {
            throw new BadGatewayException(
              `Could not recover ${SignatureType.EthSign} address`,
            );
          }

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

  private verifySafeTxHash(args: {
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
}
