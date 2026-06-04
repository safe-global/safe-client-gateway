// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { InvalidTransferError } from '@/modules/relay/domain/errors/invalid-transfer.error';
import { UnofficialMasterCopyError } from '@/modules/relay/domain/errors/unofficial-master-copy.error';
import { UnofficialMultiSendError } from '@/modules/relay/domain/errors/unofficial-multisend.error';
import { UnofficialProxyFactoryError } from '@/modules/relay/domain/errors/unofficial-proxy-factory.error';
import { UnofficialSignerFactoryError } from '@/modules/relay/domain/errors/unofficial-signer-factory.error';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';

@Injectable()
export class LimitAddressesMapper {
  constructor(
    private readonly relayTransactionHelper: RelayTransactionHelper,
  ) {}

  async getLimitAddresses(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Hex;
  }): Promise<ReadonlyArray<Address>> {
    const safeBeingRecovered =
      await this.relayTransactionHelper.getSafeBeingRecovered(args);
    if (safeBeingRecovered) {
      return [safeBeingRecovered];
    }

    // Calldata matches that of execTransaction and meets validity requirements
    if (
      this.relayTransactionHelper.isValidExecTransactionCall({
        to: args.to,
        data: args.data,
      })
    ) {
      // Safe attempting to relay is official
      const isOfficial = await this.relayTransactionHelper.isOfficialMastercopy(
        {
          chainId: args.chainId,
          address: args.to,
        },
      );

      if (!isOfficial) {
        throw new UnofficialMasterCopyError();
      }

      return [args.to];
    }

    if (this.relayTransactionHelper.isMultiSend(args.data)) {
      if (
        !this.relayTransactionHelper.isOfficialMultiSendDeployment({
          version: args.version,
          chainId: args.chainId,
          address: args.to,
        })
      ) {
        throw new UnofficialMultiSendError();
      }

      // multiSend calldata meets the validity requirements
      const safeAddress =
        this.relayTransactionHelper.getSafeAddressFromMultiSend(args.data);

      // Safe attempting to relay is official
      const isOfficial = await this.relayTransactionHelper.isOfficialMastercopy(
        {
          chainId: args.chainId,
          address: safeAddress,
        },
      );

      if (!isOfficial) {
        throw new UnofficialMasterCopyError();
      }

      // Safe targeted in batch will be limited
      return [safeAddress];
    }

    // Calldata matches that of createProxyWithNonce and meets validity requirements
    if (
      this.relayTransactionHelper.isValidCreateProxyWithNonceCall({
        version: args.version,
        chainId: args.chainId,
        data: args.data,
      })
    ) {
      if (
        !this.relayTransactionHelper.isOfficialProxyFactoryDeployment({
          version: args.version,
          chainId: args.chainId,
          address: args.to,
        })
      ) {
        throw new UnofficialProxyFactoryError();
      }
      // Owners of safe-to-be-created will be limited
      return this.relayTransactionHelper.getOwnersFromCreateProxyWithNonce(
        args.data,
      );
    }

    // Calldata matches createSigner on an official SafeWebAuthnSignerFactory.
    // The branch is self-contained: every outcome of the createSigner path
    // (unofficial factory, malformed args, success) terminates here so future
    // branches added below this point can't be reached by createSigner data.
    if (this.relayTransactionHelper.isCreateSigner(args.data)) {
      if (
        !this.relayTransactionHelper.isOfficialSignerFactoryDeployment({
          chainId: args.chainId,
          address: args.to,
        })
      ) {
        throw new UnofficialSignerFactoryError();
      }
      const signerLimitAddress =
        this.relayTransactionHelper.getSignerFactoryLimitAddress(args.data);
      if (!signerLimitAddress) {
        // Selector matched but the args failed to decode (malformed payload).
        throw new InvalidTransferError();
      }
      return [signerLimitAddress];
    }

    throw new InvalidTransferError();
  }
}
