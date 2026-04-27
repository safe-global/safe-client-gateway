import { Inject, Injectable } from '@nestjs/common';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';
import { UnofficialMasterCopyError } from '@/modules/relay/domain/errors/unofficial-master-copy.error';
import { UnofficialMultiSendError } from '@/modules/relay/domain/errors/unofficial-multisend.error';
import { InvalidTransferError } from '@/modules/relay/domain/errors/invalid-transfer.error';
import { UnofficialProxyFactoryError } from '@/modules/relay/domain/errors/unofficial-proxy-factory.error';
import { DelayModifierDecoder } from '@/modules/alerts/domain/contracts/decoders/delay-modifier-decoder.helper';
import type { Address } from 'viem';
import { RelayTransactionValidator } from '@/modules/relay/domain/relay-transaction-validator';

@Injectable()
export class LimitAddressesMapper {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    private readonly relayTransactionValidator: RelayTransactionValidator,
    private readonly safeDecoder: SafeDecoder,
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly delayModifierDecoder: DelayModifierDecoder,
  ) {}

  async getLimitAddresses(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Address;
  }): Promise<ReadonlyArray<Address>> {
    const safeBeingRecovered = await this.getSafeBeingRecovered(args);
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

      // Safe targeted by execTransaction will be limited
      return [args.to];
    }

    // Calldata matches that of multiSend and is from an official MultiSend contract
    if (this.multiSendDecoder.helpers.isMultiSend(args.data)) {
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

  /**
   * Returns the address of the Safe being recovered, if the recovery transaction is valid:
   *
   * - DelayModifier proposal (execTransactionFromModule) or execution (executeNextTx)
   * - (Batch) transaction(s) to add/remove/swap owners or change threshold on _a_ Safe
   * - Via an enabled module on said Safe
   *
   * @param {string} args.chainId - Chain ID
   * @param {string} args.version - Safe version
   * @param {string} args.to - Transaction recipient
   * @param {string} args.data - Transaction data
   *
   * @returns {string | null} - Safe address being recovered, if valid
   */
  protected async getSafeBeingRecovered(args: {
    chainId: string;
    version: string;
    to: Address;
    data: Address;
  }): Promise<Address | null> {
    let to: Address;
    let data: Address;

    try {
      const decoded = this.delayModifierDecoder.decodeFunctionData({
        data: args.data,
      });

      if (
        // Proposal
        decoded.functionName !== 'execTransactionFromModule' &&
        // Execution
        decoded.functionName !== 'executeNextTx'
      ) {
        return null;
      }

      // No need to check value/operation as call is to Safe itself
      to = decoded.args[0];
      data = decoded.args[2];
    } catch {
      return null;
    }

    // (Batched) transaction(s) of transaction
    const transactions = this.decodeTransactions({
      address: to,
      version: args.version,
      chainId: args.chainId,
      data,
    });

    const isEveryTransactionOwnerManagement = transactions.every(
      (transaction) => {
        return this.isOwnerManagementTransaction(transaction.data);
      },
    );

    if (!isEveryTransactionOwnerManagement) {
      return null;
    }

    const { safes } = await this.safeRepository.getSafesByModule({
      chainId: args.chainId,
      moduleAddress: args.to,
    });

    // Module enabled on Safe, and batch transactions target the same Safe
    const isEnabledSafe = transactions.every((transaction, _, arr) => {
      return transaction.to === arr[0].to && safes.includes(transaction.to);
    });

    if (!isEnabledSafe) {
      return null;
    }

    return transactions[0].to;
  }

  /**
   * Maps batched transactions if the data of an official multiSend call
   * @param {string} args.address - Address of the recipient
   * @param {string} args.version - Safe version
   * @param {string} args.chainId - Chain ID
   * @param {string} args.data - Data of the transaction
   * @returns {Array<{ to: string; data: string }>} - Array of transactions
   */
  private decodeTransactions(args: {
    address: Address;
    version: string;
    chainId: string;
    data: Address;
  }): Array<{
    to: Address;
    data: Address;
  }> {
    if (
      this.relayTransactionValidator.isOfficialMultiSendDeployment(args) &&
      this.multiSendDecoder.helpers.isMultiSend(args.data)
    ) {
      return this.multiSendDecoder.mapMultiSendTransactions(args.data);
    }

    return [{ to: args.address, data: args.data }];
  }

  /**
   * Checks if the data of a transaction is an owner management transaction
   * @param {string} data - Data of the transaction
   * @returns {boolean} - Whether the data is of owner management
   */
  private isOwnerManagementTransaction(data: Address): boolean {
    try {
      const decoded = this.safeDecoder.decodeFunctionData({
        data,
      });

      if (decoded.functionName !== 'execTransaction') {
        return false;
      }

      const execTransactionData = decoded.args[2];

      if (
        !this.safeDecoder.helpers.isAddOwnerWithThreshold(
          execTransactionData,
        ) &&
        !this.safeDecoder.helpers.isRemoveOwner(execTransactionData) &&
        !this.safeDecoder.helpers.isSwapOwner(execTransactionData) &&
        !this.safeDecoder.helpers.isChangeThreshold(execTransactionData)
      ) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}
