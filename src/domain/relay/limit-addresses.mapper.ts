import { Inject, Injectable } from '@nestjs/common';
import { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { ProxyFactoryDecoder } from '@/domain/relay/contracts/decoders/proxy-factory-decoder.helper';
import {
  getSafeSingletonDeployment,
  getSafeL2SingletonDeployment,
  getMultiSendCallOnlyDeployment,
  getMultiSendDeployment,
  getProxyFactoryDeployment,
} from '@safe-global/safe-deployments';
import { SafeDecoder } from '@/domain/contracts/decoders/safe-decoder.helper';
import { UnofficialMasterCopyError } from '@/domain/relay/errors/unofficial-master-copy.error';
import { UnofficialMultiSendError } from '@/domain/relay/errors/unofficial-multisend.error';
import { InvalidTransferError } from '@/domain/relay/errors/invalid-transfer.error';
import { InvalidMultiSendError } from '@/domain/relay/errors/invalid-multisend.error';
import { UnofficialProxyFactoryError } from '@/domain/relay/errors/unofficial-proxy-factory.error';

@Injectable()
export class LimitAddressesMapper {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    private readonly erc20Decoder: Erc20Decoder,
    private readonly safeDecoder: SafeDecoder,
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly proxyFactoryDecoder: ProxyFactoryDecoder,
  ) {}

  async getLimitAddresses(args: {
    version: string;
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
  }): Promise<readonly `0x${string}`[]> {
    // Calldata matches that of execTransaction and meets validity requirements
    if (
      this.isValidExecTransactionCall({
        to: args.to,
        data: args.data,
      })
    ) {
      // Safe attempting to relay is official
      const isOfficial = await this.isOfficialMastercopy({
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
        !this.isOfficialMultiSendDeployment({
          version: args.version,
          chainId: args.chainId,
          address: args.to,
        })
      ) {
        throw new UnofficialMultiSendError();
      }

      // multiSend calldata meets the validity requirements
      const safeAddress = this.getSafeAddressFromMultiSend(args.data);

      // Safe attempting to relay is official
      const isOfficial = await this.isOfficialMastercopy({
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
      this.isValidCreateProxyWithNonceCall({
        version: args.version,
        chainId: args.chainId,
        data: args.data,
      })
    ) {
      if (
        !this.isOfficialProxyFactoryDeployment({
          version: args.version,
          chainId: args.chainId,
          address: args.to,
        })
      ) {
        throw new UnofficialProxyFactoryError();
      }
      // Owners of safe-to-be-created will be limited
      return this.getOwnersFromCreateProxyWithNonce(args.data);
    }

    throw new InvalidTransferError();
  }

  private isValidExecTransactionCall(args: {
    to: `0x${string}`;
    data: `0x${string}`;
  }): boolean {
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

  private getExecTransactionArgs(data: `0x${string}`): {
    to: `0x${string}`;
    value: bigint;
    data: `0x${string}`;
  } | null {
    try {
      const safeDecodedData =
        this.safeDecoder.decodeFunctionData.execTransaction(data);

      return {
        to: safeDecodedData[0],
        value: safeDecodedData[1],
        data: safeDecodedData[2],
      };
    } catch {
      return null;
    }
  }

  private isValidErc20Transfer(args: {
    to: `0x${string}`;
    data: `0x${string}`;
  }): boolean {
    // Can throw but called after this.erc20Decoder.helpers.isTransfer
    const erc20DecodedData = this.erc20Decoder.decodeFunctionData.transfer(
      args.data,
    );

    const [to] = erc20DecodedData;
    // to 'self' (the Safe) is not allowed
    return to !== args.to;
  }

  private isValidErc20TransferFrom(args: {
    to: `0x${string}`;
    data: `0x${string}`;
  }): boolean {
    // Can throw but called after this.erc20Decoder.helpers.isTransferFrom
    const erc20DecodedData = this.erc20Decoder.decodeFunctionData.transferFrom(
      args.data,
    );

    const [sender, recipient] = erc20DecodedData;
    // to 'self' (the Safe) or from sender to sender as recipient is not allowed
    return sender !== recipient && recipient !== args.to;
  }

  private async isOfficialMastercopy(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<boolean> {
    try {
      await this.safeRepository.getSafe(args);
      return true;
    } catch {
      return false;
    }
  }

  private isOfficialMultiSendDeployment(args: {
    version: string;
    chainId: string;
    address: `0x${string}`;
  }): boolean {
    const multiSendCallOnlyDeployment = getMultiSendCallOnlyDeployment({
      version: args.version,
      network: args.chainId,
    });

    const isCallOnly =
      multiSendCallOnlyDeployment?.networkAddresses[args.chainId] ===
        args.address ||
      multiSendCallOnlyDeployment?.defaultAddress === args.address;

    if (isCallOnly) {
      return true;
    }

    const multiSendCallDeployment = getMultiSendDeployment({
      version: args.version,
      network: args.chainId,
    });
    return (
      multiSendCallDeployment?.networkAddresses[args.chainId] ===
        args.address || multiSendCallDeployment?.defaultAddress === args.address
    );
  }

  private getSafeAddressFromMultiSend = (
    data: `0x${string}`,
  ): `0x${string}` => {
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

  private isOfficialProxyFactoryDeployment(args: {
    version: string;
    chainId: string;
    address: `0x${string}`;
  }): boolean {
    const proxyFactoryDeployment = getProxyFactoryDeployment({
      version: args.version,
      network: args.chainId,
    });

    return (
      proxyFactoryDeployment?.networkAddresses[args.chainId] === args.address ||
      proxyFactoryDeployment?.defaultAddress === args.address
    );
  }

  private isValidCreateProxyWithNonceCall(args: {
    version: string;
    chainId: string;
    data: `0x${string}`;
  }): boolean {
    let singleton: `0x${string}` | null = null;

    try {
      const decoded =
        this.proxyFactoryDecoder.decodeFunctionData.createProxyWithNonce(
          args.data,
        );

      singleton = decoded[0];
    } catch (e) {
      return false;
    }

    const safeL1Deployment = getSafeSingletonDeployment({
      version: args.version,
      network: args.chainId,
    });
    const safeL2Deployment = getSafeL2SingletonDeployment({
      version: args.version,
      network: args.chainId,
    });

    const isL1Singleton =
      safeL1Deployment?.networkAddresses[args.chainId] === singleton;
    const isL2Singleton =
      safeL2Deployment?.networkAddresses[args.chainId] === singleton;

    return isL1Singleton || isL2Singleton;
  }

  private getOwnersFromCreateProxyWithNonce(
    data: `0x${string}`,
  ): readonly `0x${string}`[] {
    // Can throw but called after this.isValidCreateProxyWithNonceCall
    const decodedProxyFactory =
      this.proxyFactoryDecoder.decodeFunctionData.createProxyWithNonce(data);

    const initializer = decodedProxyFactory[1];
    const decodedSafe = this.safeDecoder.decodeFunctionData.setup(initializer);

    return decodedSafe[0];
  }
}
