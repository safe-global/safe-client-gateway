// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { InvalidTransferError } from '@/modules/relay/domain/errors/invalid-transfer.error';
import { UnofficialMasterCopyError } from '@/modules/relay/domain/errors/unofficial-master-copy.error';
import { UnofficialMultiSendError } from '@/modules/relay/domain/errors/unofficial-multisend.error';
import { UnofficialProxyFactoryError } from '@/modules/relay/domain/errors/unofficial-proxy-factory.error';
import { UnofficialSignerFactoryError } from '@/modules/relay/domain/errors/unofficial-signer-factory.error';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';

/**
 * What a relayed call was recognised to act on. Internal to the mapper: no
 * boundary parses it, so it stays a type beside its producer rather than a
 * schema under `domain/entities/`.
 */
export type RelayTarget = {
  /**
   * The Safe the call acts on, or `null` where none exists yet: a Safe
   * creation limits its owners, and a passkey signer deployment its signer.
   */
  safe: Address | null;
  /** The addresses a per-address limit is counted against. */
  addresses: ReadonlyArray<Address>;
};

@Injectable()
export class LimitAddressesMapper {
  constructor(
    private readonly relayTransactionHelper: RelayTransactionHelper,
  ) {}

  /** The addresses a per-address limit is counted against. */
  async getLimitAddresses(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Hex;
  }): Promise<ReadonlyArray<Address>> {
    return (await this.resolveTarget(args)).addresses;
  }

  /**
   * The same recognition, keeping what each branch knew it had found: which
   * Safe the call acts on, where there is one. Every rejection below is what
   * makes a relay safe to pay for, so a caller that only needs the Safe still
   * goes through here.
   */
  async resolveTarget(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Hex;
  }): Promise<RelayTarget> {
    const safeBeingRecovered =
      await this.relayTransactionHelper.getSafeBeingRecovered(args);
    if (safeBeingRecovered) {
      return { safe: safeBeingRecovered, addresses: [safeBeingRecovered] };
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

      return { safe: args.to, addresses: [args.to] };
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
      return { safe: safeAddress, addresses: [safeAddress] };
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
      // Owners of safe-to-be-created will be limited; the Safe does not exist
      // yet, so there is none to attribute the call to.
      return {
        safe: null,
        addresses:
          this.relayTransactionHelper.getOwnersFromCreateProxyWithNonce(
            args.data,
          ),
      };
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
      return { safe: null, addresses: [signerLimitAddress] };
    }

    throw new InvalidTransferError();
  }
}
