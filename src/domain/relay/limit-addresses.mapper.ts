import { Inject, Injectable } from '@nestjs/common';
import { Hex } from 'viem/types/misc';
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
import { getAddress, isAddress, isHex } from 'viem';
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
    to: string;
    data: string;
  }): Promise<readonly Hex[]> {
    if (!isAddress(args.to)) {
      throw Error('Invalid to provided');
    }

    if (!isHex(args.data)) {
      throw Error('Invalid data provided');
    }

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

  private isValidExecTransactionCall(args: { to: string; data: Hex }): boolean {
    let execTransaction: { data: Hex; to: Hex; value: bigint };
    // If transaction is an execTransaction
    try {
      const safeDecodedData = this.safeDecoder.decodeFunctionData({
        data: args.data,
      });
      if (safeDecodedData.functionName !== 'execTransaction') {
        return false;
      }
      const [to, value, data] = safeDecodedData.args;
      execTransaction = { to, value, data };
    } catch (e) {
      return false;
    }

    // If data of execTransaction is of ERC20
    try {
      const erc20DecodedData = this.erc20Decoder.decodeFunctionData({
        data: execTransaction.data,
      });

      // `transfer` to 'self' (the Safe) is not allowed
      if (erc20DecodedData.functionName === 'transfer') {
        const to = erc20DecodedData.args[0];
        // TODO: Propagate checksummed address types from RelayDto from controller
        return to !== getAddress(args.to);
      }

      // `transferFrom` to 'self' or from sender to sender as recipient is not allowed
      if (erc20DecodedData.functionName === 'transferFrom') {
        const [sender, recipient] = erc20DecodedData.args;
        return (
          sender !== recipient &&
          // TODO: Propagate checksummed address types from RelayDto from controller
          recipient !== getAddress(args.to)
        );
      }

      // Otherwise allow other methods
      return true;
    } catch {
      // swallow exception if data is not an ERC20 transfer
    }

    // If a transaction does not target 'self' consider it valid
    if (args.to !== execTransaction.to) {
      return true;
    }

    // Transaction targets 'self'
    // Block transactions targeting self with a value greater than 0
    if (execTransaction.value > BigInt(0)) {
      return false;
    }

    const isCancellation = execTransaction.data === '0x';
    return isCancellation || this.safeDecoder.isCall(execTransaction.data);
  }

  private async isOfficialMastercopy(args: {
    chainId: string;
    address: string;
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
    address: string;
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

  private getSafeAddressFromMultiSend = (data: Hex): Hex => {
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
    address: string;
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
    data: Hex;
  }): boolean {
    let singleton: string | null = null;

    try {
      const decoded = this.proxyFactoryDecoder.decodeFunctionData({
        data: args.data,
      });

      if (decoded.functionName !== 'createProxyWithNonce') {
        return false;
      }

      singleton = decoded.args[0];
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

  private getOwnersFromCreateProxyWithNonce(data: Hex): readonly Hex[] {
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
