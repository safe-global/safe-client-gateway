import { Inject, Injectable } from '@nestjs/common';
import { Hex } from 'viem/types/misc';
import { Erc20Decoder } from '@/domain/relay/contracts/erc-20-decoder.helper';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { MultiSendDecoder } from '@/domain/contracts/contracts/multi-send-decoder.helper';
import { ProxyFactoryDecoder } from '@/domain/relay/contracts/proxy-factory-decoder.helper';
import {
  getSafeSingletonDeployment,
  getSafeL2SingletonDeployment,
  getMultiSendCallOnlyDeployment,
} from '@safe-global/safe-deployments';
import { SafeDecoder } from '@/domain/contracts/contracts/safe-decoder.helper';

export interface RelayPayload {
  chainId: string;
  data: Hex;
  to: Hex;
  gasLimit?: bigint;
}

@Injectable()
export class LimitAddressesMapper {
  // TODO: Support all versions (decoders currently use 1.3.0 ABIs though interface is generic)
  private static SUPPORTED_SAFE_VERSION = '1.3.0';

  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    private readonly erc20Decoder: Erc20Decoder,
    private readonly safeDecoder: SafeDecoder,
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly proxyFactoryDecoder: ProxyFactoryDecoder,
  ) {}

  async getLimitAddresses(args: RelayPayload): Promise<readonly Hex[]> {
    // Calldata matches that of execTransaction and meets validity requirements
    if (this.isValidExecTransactionCall(args)) {
      // Safe attempting to relay is official
      const isOfficial = await this.isOfficialMastercopy({
        chainId: args.chainId,
        address: args.to,
      });

      if (!isOfficial) {
        throw Error('Invalid Safe contract');
      }

      // Safe targetted by execTransaction will be limited
      return [args.to];
    }

    // Calldata matches that of multiSend and is from an official MultiSend contract
    if (
      this.multiSendDecoder.isMultiSend(args.data) &&
      this.isOfficialMultiSendDeployment({
        chainId: args.chainId,
        address: args.to,
      })
    ) {
      // multiSend calldata meets the validity requirements
      const safeAddress = this.getSafeAddressFromMultiSend(args.data);

      // Safe attempting to relay is official
      const isOfficial = await this.isOfficialMastercopy({
        chainId: args.chainId,
        address: safeAddress,
      });

      if (!isOfficial) {
        throw Error('Invalid Safe contract');
      }

      // Safe targetted in batch will be limited
      return [safeAddress];
    }

    // Calldata matches that of createProxyWithNonce and meets validity requirements
    if (this.isValidCreateProxyWithNonceCall(args)) {
      // Owners of safe-to-be-created will be limited
      return this.getOwnersFromCreateProxyWithNonce(args.data);
    }

    throw Error('Cannot get limit addresses – Invalid transfer');
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

    // If data of execTransaction is an ERC20 transfer
    try {
      const erc20DecodedData = this.erc20Decoder.decodeFunctionData({
        data: execTransaction.data,
      });
      // If the ERC20 transfer targets 'self' (the Safe), we consider it to be invalid
      return (
        erc20DecodedData.functionName === 'transfer' &&
        erc20DecodedData.args[0] !== args.to
      );
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
    chainId: string;
    address: string;
  }): boolean {
    const multiSendDeployment = getMultiSendCallOnlyDeployment({
      version: LimitAddressesMapper.SUPPORTED_SAFE_VERSION,
      network: args.chainId,
    });
    return (
      multiSendDeployment?.networkAddresses[args.chainId] === args.address ||
      multiSendDeployment?.defaultAddress === args.address
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
      throw Error('Invalid MultiSend transactions');
    }

    const firstRecipient = transactions[0].to;

    const isSameRecipient = transactions.every((transaction) => {
      return transaction.to === firstRecipient;
    });

    if (!isSameRecipient) {
      throw Error('MultiSend transactions target different addresses');
    }

    return firstRecipient;
  };

  private isValidCreateProxyWithNonceCall(args: {
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
      version: LimitAddressesMapper.SUPPORTED_SAFE_VERSION,
      network: args.chainId,
    });
    const safeL2Deployment = getSafeL2SingletonDeployment({
      version: LimitAddressesMapper.SUPPORTED_SAFE_VERSION,
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
      throw Error('Not a createProxyWithNonce call');
    }

    const initializer = decodedProxyFactory.args[1];
    const decodedSafe = this.safeDecoder.decodeFunctionData({
      data: initializer,
    });

    if (decodedSafe.functionName !== 'setup') {
      throw Error('Not a setup call');
    }

    return decodedSafe.args[0];
  }
}
