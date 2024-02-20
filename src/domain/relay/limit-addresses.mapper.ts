import { Inject, Injectable } from '@nestjs/common';
import { Hex } from 'viem/types/misc';
import { Erc20ContractHelper } from '@/domain/relay/contracts/erc20-contract.helper';
import { SafeContractHelper } from '@/domain/relay/contracts/safe-contract.helper';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { MultiSendDecoder } from '@/domain/contracts/contracts/multi-send-decoder.helper';
import { ProxyFactoryDecoder } from '@/domain/relay/contracts/proxy-factory-decoder.helper';
import {
  getSafeSingletonDeployment,
  getSafeL2SingletonDeployment,
  getMultiSendCallOnlyDeployment,
  getMultiSendDeployment,
} from '@safe-global/safe-deployments';
import { SafeDecoder } from '@/domain/contracts/contracts/safe-decoder.helper';
import { isAddress, isHex } from 'viem';
import { UnofficialMasterCopyError } from '@/domain/relay/errors/unofficial-master-copy.error';
import { UnofficialMultiSendError } from '@/domain/relay/errors/unofficial-multisend.error';
import { InvalidTransferError } from '@/domain/relay/errors/invalid-transfer.error';
import { InvalidMultiSendError } from '@/domain/relay/errors/invalid-multisend.error';

@Injectable()
export class LimitAddressesMapper {
  // TODO: Abstract with that from SafeContractHelper
  private static SUPPORTED_SAFE_VERSION = '1.3.0';

  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    private readonly safeContract: SafeContractHelper,
    private readonly erc20Contract: Erc20ContractHelper,
    private readonly safeDecoder: SafeDecoder,
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly proxyFactoryDecoder: ProxyFactoryDecoder,
  ) {}

  async getLimitAddresses(args: {
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
        chainId: args.chainId,
        data: args.data,
      })
    ) {
      // Owners of safe-to-be-created will be limited
      return this.getOwnersFromCreateProxyWithNonce(args.data);
    }

    throw new InvalidTransferError();
  }

  private isValidExecTransactionCall(args: { to: string; data: Hex }): boolean {
    let execTransaction: { data: Hex; to: Hex; value: bigint };
    // If transaction is an execTransaction
    try {
      execTransaction = this.safeContract.decode(
        SafeContractHelper.EXEC_TRANSACTION,
        args.data,
      );
    } catch (e) {
      return false;
    }

    // If data of execTransaction is an ERC20 transfer
    try {
      const erc20DecodedData = this.erc20Contract.decode(
        Erc20ContractHelper.TRANSFER,
        execTransaction.data,
      );
      // If the ERC20 transfer targets 'self' (the Safe), we consider it to be invalid
      return erc20DecodedData.to !== args.to;
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
    return isCancellation || this.safeContract.isCall(execTransaction.data);
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
    const multiSendCallOnlyDeployment = getMultiSendCallOnlyDeployment({
      version: LimitAddressesMapper.SUPPORTED_SAFE_VERSION,
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
      version: LimitAddressesMapper.SUPPORTED_SAFE_VERSION,
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
