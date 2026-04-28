// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { UnofficialMasterCopyError } from '@/modules/relay/domain/errors/unofficial-master-copy.error';
import { UnofficialMultiSendError } from '@/modules/relay/domain/errors/unofficial-multisend.error';
import { InvalidTransferError } from '@/modules/relay/domain/errors/invalid-transfer.error';
import { UnofficialProxyFactoryError } from '@/modules/relay/domain/errors/unofficial-proxy-factory.error';
import type { Address } from 'viem';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';

@Injectable()
export class LimitAddressesMapper {
  constructor(
    private readonly relayTransactionValidator: RelayTransactionHelper,
  ) {}

  async getLimitAddresses(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Address;
  }): Promise<ReadonlyArray<Address>> {
    const safeBeingRecovered =
      await this.relayTransactionValidator.getSafeBeingRecovered(args);
    if (safeBeingRecovered) {
      return [safeBeingRecovered];
    }

    // Calldata matches that of execTransaction and meets validity requirements
    if (
      this.relayTransactionValidator.isValidExecTransactionCall({
        to: args.to,
        data: args.data,
      })
    ) {
      // Safe attempting to relay is official
      const isOfficial =
        await this.relayTransactionValidator.isOfficialMastercopy({
          chainId: args.chainId,
          address: args.to,
        });

      if (!isOfficial) {
        throw new UnofficialMasterCopyError();
      }

      return [args.to];
    }

    if (this.relayTransactionValidator.isMultiSend(args.data)) {
      if (
        !this.relayTransactionValidator.isOfficialMultiSendDeployment({
          version: args.version,
          chainId: args.chainId,
          address: args.to,
        })
      ) {
        throw new UnofficialMultiSendError();
      }

      // multiSend calldata meets the validity requirements
      const safeAddress =
        this.relayTransactionValidator.getSafeAddressFromMultiSend(args.data);

      // Safe attempting to relay is official
      const isOfficial =
        await this.relayTransactionValidator.isOfficialMastercopy({
          chainId: args.chainId,
          address: safeAddress,
        });

      if (!isOfficial) {
        throw new UnofficialMasterCopyError();
      }

      // Safe targeted in batch will be limited
      return [safeAddress];
    }

    // Calldata matches that of createProxyWithNonce and meets validity requirements
    if (
      this.relayTransactionValidator.isValidCreateProxyWithNonceCall({
        version: args.version,
        chainId: args.chainId,
        data: args.data,
      })
    ) {
      if (
        !this.relayTransactionValidator.isOfficialProxyFactoryDeployment({
          version: args.version,
          chainId: args.chainId,
          address: args.to,
        })
      ) {
        throw new UnofficialProxyFactoryError();
      }
      // Owners of safe-to-be-created will be limited
      return this.relayTransactionValidator.getOwnersFromCreateProxyWithNonce(
        args.data,
      );
    }

    throw new InvalidTransferError();
  }
}
