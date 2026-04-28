// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { ProxyFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/proxy-factory-decoder.helper';
import {
  getSafeSingletonDeployments,
  getSafeL2SingletonDeployments,
  getMultiSendCallOnlyDeployments,
  getMultiSendDeployments,
  getProxyFactoryDeployments,
} from '@/domain/common/utils/deployments';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';
import { InvalidMultiSendError } from '@/modules/relay/domain/errors/invalid-multisend.error';
import { DelayModifierDecoder } from '@/modules/alerts/domain/contracts/decoders/delay-modifier-decoder.helper';
import type { SafeTransaction } from '@/modules/transactions/domain/entities/safe-transaction.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import Safe130 from '@/abis/safe/v1.3.0/GnosisSafe.abi';
import Safe141 from '@/abis/safe/v1.4.1/Safe.abi';
import Safe150 from '@/abis/safe/v1.5.0/Safe.abi';
import semverSatisfies from 'semver/functions/satisfies';
import type { Address, Hex } from 'viem';

type SafeAbi = typeof Safe130 | typeof Safe141 | typeof Safe150;

@Injectable()
export class RelayTransactionHelper {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IBlockchainApiManager)
    private readonly blockchainApiManager: IBlockchainApiManager,
    private readonly erc20Decoder: Erc20Decoder,
    private readonly safeDecoder: SafeDecoder,
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly proxyFactoryDecoder: ProxyFactoryDecoder,
    private readonly delayModifierDecoder: DelayModifierDecoder,
  ) {}

  private getSafeAbi(version: string): SafeAbi {
    if (semverSatisfies(version, '>=1.5.0')) return Safe150;
    if (semverSatisfies(version, '>=1.4.0')) return Safe141;
    if (semverSatisfies(version, '>=1.0.0')) return Safe130;
    this.loggingService.warn({
      type: LogType.TxRelayEligibility,
      message: `getSafeAbi: unrecognised Safe version ${version}, falling back to 1.3.0 ABI`,
    });
    return Safe130;
  }

  isValidExecTransactionCall(args: { to: Address; data: Hex }): boolean {
    const execTransactionArgs = this.getExecTransactionArgs(args.data);
    // Not a valid execTransaction call
    if (!execTransactionArgs) {
      return false;
    }

    // Only ERC-20 transfer to other party is valid
    if (this.erc20Decoder.helpers.isTransfer(execTransactionArgs.data)) {
      return this.isValidErc20Transfer({
        to: args.to,
        data: execTransactionArgs.data,
      });
    }

    // Only ERC-20 transferFrom to other party is valid
    if (this.erc20Decoder.helpers.isTransferFrom(execTransactionArgs.data)) {
      return this.isValidErc20TransferFrom({
        to: args.to,
        data: execTransactionArgs.data,
      });
    }

    // Only transaction to other party is valid
    const toSelf = execTransactionArgs.to === args.to;
    if (!toSelf) {
      return true;
    }

    // Only transaction with no value is valid
    const hasValue = execTransactionArgs.value > BigInt(0);
    if (hasValue) {
      return false;
    }

    // Cancellations and Safe calls (e.g. owner management) are valid
    const isCancellation = execTransactionArgs.data === '0x';
    return isCancellation || this.safeDecoder.isCall(execTransactionArgs.data);
  }

  private getExecTransactionArgs(data: Hex): SafeTransaction | null {
    try {
      const safeDecodedData = this.safeDecoder.decodeFunctionData({
        data,
      });

      if (safeDecodedData.functionName !== 'execTransaction') {
        return null;
      }

      const [
        to,
        value,
        innerData,
        operation,
        safeTxGas,
        baseGas,
        gasPrice,
        gasToken,
        refundReceiver,
      ] = safeDecodedData.args;

      return {
        to,
        value,
        data: innerData,
        operation,
        safeTxGas,
        baseGas,
        gasPrice,
        gasToken,
        refundReceiver,
      };
    } catch {
      return null;
    }
  }

  private isValidErc20Transfer(args: { to: Address; data: Hex }): boolean {
    // Can throw but called after this.erc20Decoder.helpers.isTransfer
    const erc20DecodedData = this.erc20Decoder.decodeFunctionData({
      data: args.data,
    });

    if (erc20DecodedData.functionName !== 'transfer') {
      return false;
    }

    const [to] = erc20DecodedData.args;
    // to 'self' (the Safe) is not allowed
    return to !== args.to;
  }

  private isValidErc20TransferFrom(args: { to: Address; data: Hex }): boolean {
    // Can throw but called after this.erc20Decoder.helpers.isTransferFrom
    const erc20DecodedData = this.erc20Decoder.decodeFunctionData({
      data: args.data,
    });

    if (erc20DecodedData.functionName !== 'transferFrom') {
      return false;
    }

    const [sender, recipient] = erc20DecodedData.args;
    // to 'self' (the Safe) or from sender to sender as recipient is not allowed
    return sender !== recipient && recipient !== args.to;
  }

  async isOfficialMastercopy(args: {
    chainId: string;
    address: Address;
  }): Promise<boolean> {
    try {
      await this.safeRepository.getSafe(args);
      return true;
    } catch {
      return false;
    }
  }

  isMultiSend(data: Hex): boolean {
    return this.multiSendDecoder.helpers.isMultiSend(data);
  }

  isOfficialMultiSendDeployment(args: {
    version: string;
    chainId: string;
    address: Address;
  }): boolean {
    return (
      getMultiSendCallOnlyDeployments(args).includes(args.address) ||
      getMultiSendDeployments(args).includes(args.address)
    );
  }

  getSafeAddressFromMultiSend = (data: Hex): Address => {
    // Decode transactions within MultiSend
    const transactions = this.multiSendDecoder.mapMultiSendTransactions(data);

    // Every transaction is a valid execTransaction
    const isEveryValid = transactions.every((transaction) => {
      return this.isValidExecTransactionCall(transaction);
    });

    if (!isEveryValid) {
      throw new InvalidMultiSendError();
    }

    const firstRecipient = transactions[0].to;

    const isSameRecipient = transactions.every((transaction) => {
      return transaction.to === firstRecipient;
    });

    // Transactions calls execTransaction on varying addresses
    if (!isSameRecipient) {
      throw new InvalidMultiSendError();
    }

    return firstRecipient;
  };

  isOfficialProxyFactoryDeployment(args: {
    version: string;
    chainId: string;
    address: Address;
  }): boolean {
    const proxyFactoryDeployments = getProxyFactoryDeployments(args);
    return proxyFactoryDeployments.includes(args.address);
  }

  isValidCreateProxyWithNonceCall(args: {
    version: string;
    chainId: string;
    data: Hex;
  }): boolean {
    let singleton: Address | null = null;

    try {
      const decoded = this.proxyFactoryDecoder.decodeFunctionData({
        data: args.data,
      });

      if (decoded.functionName !== 'createProxyWithNonce') {
        return false;
      }

      singleton = decoded.args[0];
    } catch {
      return false;
    }

    return (
      getSafeSingletonDeployments(args).includes(singleton) ||
      getSafeL2SingletonDeployments(args).includes(singleton)
    );
  }

  getOwnersFromCreateProxyWithNonce(data: Hex): ReadonlyArray<Address> {
    const decodedProxyFactory = this.proxyFactoryDecoder.decodeFunctionData({
      data,
    });

    if (decodedProxyFactory.functionName !== 'createProxyWithNonce') {
      // Should never happen but check is needed to satisfy TypeScript
      throw Error('Not a createProxyWithNonce call');
    }

    const initializer = decodedProxyFactory.args[1];
    const decodedSafe = this.safeDecoder.decodeFunctionData({
      data: initializer,
    });

    if (decodedSafe.functionName !== 'setup') {
      // No custom error thrown, as caller subsequently throws InvalidTransferError
      throw Error('Not a setup call');
    }

    return decodedSafe.args[0];
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
  async getSafeBeingRecovered(args: {
    chainId: string;
    version: string;
    to: Address;
    data: Hex;
  }): Promise<Address | null> {
    let to: Address;
    let data: Hex;

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
    data: Hex;
  }): Array<{
    to: Address;
    data: Hex;
  }> {
    if (
      this.isOfficialMultiSendDeployment(args) &&
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
  isOwnerManagementTransaction(data: Hex): boolean {
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

  async isSafeTxHashValid(args: {
    version: string;
    chainId: string;
    safeAddress: Address;
    data: Hex;
    safeTxHash: Hex;
  }): Promise<boolean> {
    const decoded = this.getExecTransactionArgs(args.data);

    if (!decoded) {
      return false;
    }

    const abi = this.getSafeAbi(args.version);

    try {
      const publicClient = await this.blockchainApiManager.getApi(args.chainId);

      const nonce = await publicClient.readContract({
        address: args.safeAddress,
        abi,
        functionName: 'nonce',
      });

      const onChainHash = await publicClient.readContract({
        address: args.safeAddress,
        abi,
        functionName: 'getTransactionHash',
        args: [
          decoded.to,
          decoded.value,
          decoded.data,
          decoded.operation,
          decoded.safeTxGas,
          decoded.baseGas,
          decoded.gasPrice,
          decoded.gasToken,
          decoded.refundReceiver,
          nonce,
        ],
      });

      if (onChainHash !== args.safeTxHash) {
        this.loggingService.warn({
          type: LogType.TxRelayEligibility,
          message: `relay-fee safeTxHash mismatch for ${args.safeAddress} on chain ${args.chainId}`,
        });
        return false;
      }

      return true;
    } catch (error) {
      this.loggingService.error({
        type: LogType.TxRelayEligibility,
        message: `relay-fee RPC error verifying safeTxHash for ${args.safeAddress} on chain ${args.chainId}: ${String(error)}`,
      });
      return false;
    }
  }
}
