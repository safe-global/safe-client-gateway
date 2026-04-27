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
import type { Address } from 'viem';

@Injectable()
export class RelayTransactionValidator {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    private readonly erc20Decoder: Erc20Decoder,
    private readonly safeDecoder: SafeDecoder,
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly proxyFactoryDecoder: ProxyFactoryDecoder,
    private readonly delayModifierDecoder: DelayModifierDecoder,
  ) {}

  isValidExecTransactionCall(args: { to: Address; data: Address }): boolean {
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

  getExecTransactionArgs(data: Address): SafeTransaction | null {
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

  private isValidErc20Transfer(args: { to: Address; data: Address }): boolean {
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

  private isValidErc20TransferFrom(args: {
    to: Address;
    data: Address;
  }): boolean {
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

  getSafeAddressFromMultiSend = (data: Address): Address => {
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
    data: Address;
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

  getOwnersFromCreateProxyWithNonce(data: Address): ReadonlyArray<Address> {
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
}
