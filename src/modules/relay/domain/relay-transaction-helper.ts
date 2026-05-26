// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  parseAbiParameters,
  zeroAddress,
} from 'viem';
import { LogType } from '@/domain/common/entities/log-type.entity';
import {
  getMultiSendCallOnlyDeployments,
  getMultiSendDeployments,
  getProxyFactoryDeployments,
  getSafeL2SingletonDeployments,
  getSafeSingletonDeployments,
  getSignerFactoryDeployments,
} from '@/domain/common/utils/deployments';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { DelayModifierDecoder } from '@/modules/alerts/domain/contracts/decoders/delay-modifier-decoder.helper';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';
import { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import { ProxyFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/proxy-factory-decoder.helper';
import { SignerFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/signer-factory-decoder.helper';
import { InvalidMultiSendError } from '@/modules/relay/domain/errors/invalid-multisend.error';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { SafeTransaction } from '@/modules/transactions/domain/entities/safe-transaction.entity';

@Injectable()
export class RelayTransactionHelper {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    private readonly erc20Decoder: Erc20Decoder,
    private readonly safeDecoder: SafeDecoder,
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly proxyFactoryDecoder: ProxyFactoryDecoder,
    private readonly delayModifierDecoder: DelayModifierDecoder,
    private readonly signerFactoryDecoder: SignerFactoryDecoder,
  ) {}

  isValidExecTransactionCall(args: { to: Address; data: Hex }): boolean {
    const decoded = this.decodeExecTransaction(args.data);
    if (!decoded) return false;
    return this.isValidDecodedExecTransaction({ to: args.to, decoded });
  }

  isValidDecodedExecTransaction(args: {
    to: Address;
    decoded: SafeTransaction;
  }): boolean {
    const { decoded } = args;

    // Only ERC-20 transfer to other party is valid
    if (this.erc20Decoder.helpers.isTransfer(decoded.data)) {
      return this.isValidErc20Transfer({ to: args.to, data: decoded.data });
    }

    // Only ERC-20 transferFrom to other party is valid
    if (this.erc20Decoder.helpers.isTransferFrom(decoded.data)) {
      return this.isValidErc20TransferFrom({ to: args.to, data: decoded.data });
    }

    const toSelf = decoded.to === args.to;
    if (!toSelf) {
      return true;
    }

    return this.isValidSelfTransaction(decoded);
  }

  private isValidSelfTransaction(decoded: SafeTransaction): boolean {
    // Only transaction with no value is valid
    const hasValue = decoded.value > BigInt(0);
    if (hasValue) {
      return false;
    }

    // Cancellations and Safe calls (e.g. owner management) are valid
    const isCancellation = decoded.data === '0x';
    return isCancellation || this.safeDecoder.isCall(decoded.data);
  }

  decodeExecTransaction(data: Hex): SafeTransaction | null {
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

  getSafeAddressFromMultiSend(data: Hex): Address {
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
  }

  isOfficialProxyFactoryDeployment(args: {
    version: string;
    chainId: string;
    address: Address;
  }): boolean {
    const proxyFactoryDeployments = getProxyFactoryDeployments(args);
    return proxyFactoryDeployments.includes(args.address);
  }

  isCreateSigner(data: Hex): boolean {
    return this.signerFactoryDecoder.helpers.isCreateSigner(data);
  }

  isOfficialSignerFactoryDeployment(args: {
    chainId: string;
    address: Address;
  }): boolean {
    return getSignerFactoryDeployments({ chainId: args.chainId }).includes(
      args.address,
    );
  }

  /**
   * For `createSigner` calldata, returns a per-passkey limit key derived from
   * the call arguments.
   *
   * The key is the last 20 bytes of `keccak256(abi.encode(x, y, verifiers))`
   * cast to an Address-shaped string. This gives each unique passkey
   * (x, y, verifiers) its own daily relay quota, instead of every user
   * sharing the factory address as a limit key.
   *
   * Returns `null` if the args fail to decode (e.g. selector matches but the
   * payload is malformed). Caller must have already verified the selector
   * matches `createSigner` and that `to` is an official factory.
   *
   * Note: the `isCreateSigner` selector pre-check at the call site is not
   * redundant with the `decodeFunctionData` + `functionName` check here —
   * `getSigner` is also in the ABI and would decode cleanly.
   */
  getSignerFactoryLimitAddress(data: Hex): Address | null {
    let x: bigint;
    let y: bigint;
    let verifiers: bigint;
    try {
      const decoded = this.signerFactoryDecoder.decodeFunctionData({
        data,
      });
      if (decoded.functionName !== 'createSigner') {
        return null;
      }
      [x, y, verifiers] = decoded.args;
    } catch {
      return null;
    }

    const hash = keccak256(
      encodeAbiParameters(parseAbiParameters('uint256, uint256, uint176'), [
        x,
        y,
        verifiers,
      ]),
    );
    return getAddress(`0x${hash.slice(-40)}`);
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
   * @returns {Address | null} - Safe address being recovered, if valid
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
        !(
          this.safeDecoder.helpers.isAddOwnerWithThreshold(
            execTransactionData,
          ) ||
          this.safeDecoder.helpers.isRemoveOwner(execTransactionData) ||
          this.safeDecoder.helpers.isSwapOwner(execTransactionData) ||
          this.safeDecoder.helpers.isChangeThreshold(execTransactionData)
        )
      ) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates `safeTxHash` against the proposed transaction stored in the Safe Transaction Service.
   *
   * Looks up the transaction the service has stored under `safeTxHash`,
   * asserts it belongs to `safeAddress`, and then performs a field-by-field
   * equality check between the stored proposal and the `decoded`
   * `execTransaction` calldata the relay is being asked to submit. Trusts the
   * tx service to have computed its stored `safeTxHash` correctly at proposal
   * time — see {@link checkSafeTx} for the comparison rules.
   *
   * @returns `true` when the proposal matches the relay payload; `false` on
   * lookup failure, safe-address mismatch, or any field mismatch. Failures are
   * logged with {@link LogType.TxRelayEligibility}.
   */
  async isSafeTxHashValid(args: {
    chainId: string;
    safeAddress: Address;
    decoded: SafeTransaction;
    safeTxHash: Hex;
  }): Promise<boolean> {
    let stored: MultisigTransaction;
    try {
      stored = await this.safeRepository.getMultiSigTransaction({
        chainId: args.chainId,
        safeTransactionHash: args.safeTxHash,
      });
    } catch (error) {
      this.loggingService.warn({
        type: LogType.TxRelayEligibility,
        message: `relay-fee tx service lookup failed for ${args.safeAddress} on chain ${args.chainId} hash=${args.safeTxHash}: ${String(error)}`,
      });
      return false;
    }

    if (getAddress(stored.safe) !== args.safeAddress) {
      this.loggingService.warn({
        type: LogType.TxRelayEligibility,
        message: `relay-fee safe address mismatch for ${args.safeAddress} on chain ${args.chainId} hash=${args.safeTxHash}`,
      });
      return false;
    }

    const mismatches = this.checkSafeTx({
      stored,
      decoded: args.decoded,
    });
    if (mismatches.length > 0) {
      this.loggingService.warn({
        type: LogType.TxRelayEligibility,
        message: `relay-fee safeTxHash field mismatch for ${args.safeAddress} on chain ${args.chainId} hash=${args.safeTxHash}: ${mismatches.join(',')}`,
      });
      return false;
    }

    return true;
  }

  /**
   * Compares a tx-service-stored multisig transaction against the decoded
   * relay-submitted `execTransaction` payload, returning the names of any
   * fields that don't match.
   *
   * Coerces the two sides into a common form before comparison:
   * - addresses are checksum-normalized via `getAddress`
   * - numerics are widened to `bigint` (stored numbers/strings vs decoded `bigint`s)
   * - nullable stored fields are treated as their zero/empty equivalents:
   *   `data: null` → `'0x'`, `safeTxGas/baseGas: null` → `0n`,
   *   `gasPrice: null` → `0n`, `gasToken/refundReceiver: null` → `zeroAddress`
   *
   * Does NOT compare `nonce` — it is implicitly committed to by the tx
   * service's stored `safeTxHash` invariant. Does NOT compare `safe` — caller
   * is expected to have already asserted that.
   *
   * @returns array of mismatched field names; empty when all fields match.
   */
  private checkSafeTx(args: {
    stored: MultisigTransaction;
    decoded: SafeTransaction;
  }): Array<string> {
    const { stored, decoded } = args;
    const mismatches: Array<string> = [];

    if (getAddress(stored.to) !== getAddress(decoded.to)) {
      mismatches.push('to');
    }
    if (BigInt(stored.value) !== decoded.value) {
      mismatches.push('value');
    }
    if ((stored.data ?? '0x').toLowerCase() !== decoded.data.toLowerCase()) {
      mismatches.push('data');
    }
    if (Number(stored.operation) !== decoded.operation) {
      mismatches.push('operation');
    }
    if (BigInt(stored.safeTxGas ?? 0) !== decoded.safeTxGas) {
      mismatches.push('safeTxGas');
    }
    if (BigInt(stored.baseGas ?? 0) !== decoded.baseGas) {
      mismatches.push('baseGas');
    }
    if (BigInt(stored.gasPrice ?? '0') !== decoded.gasPrice) {
      mismatches.push('gasPrice');
    }
    if (
      getAddress(stored.gasToken ?? zeroAddress) !==
      getAddress(decoded.gasToken)
    ) {
      mismatches.push('gasToken');
    }
    if (
      getAddress(stored.refundReceiver ?? zeroAddress) !==
      getAddress(decoded.refundReceiver)
    ) {
      mismatches.push('refundReceiver');
    }

    return mismatches;
  }
}
