import { Inject, Injectable } from '@nestjs/common';
import { Hex } from 'viem/types/misc';
import { Erc20ContractHelper } from '@/domain/relay/contracts/erc20-contract.helper';
import { SafeContractHelper } from '@/domain/relay/contracts/safe-contract.helper';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { MultiSendDecoder } from '@/domain/alerts/contracts/multi-send-decoder.helper';
import { ProxyFactoryDecoder } from '@/domain/relay/contracts/proxy-factory-decoder.helper';
import {
  getSafeSingletonDeployment,
  getSafeL2SingletonDeployment,
} from '@safe-global/safe-deployments';
import { SafeDecoder } from '@/domain/alerts/contracts/safe-decoder.helper';

export interface RelayPayload {
  chainId: string;
  data: Hex;
  to: Hex;
  gasLimit: bigint;
}

@Injectable()
export class LimitAddressesMapper {
  // TODO: Abstract with that from SafeContractHelper
  private static SUPPORTED_SAFE_VERSION = '1.3.0';

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    private readonly safeContract: SafeContractHelper,
    private readonly erc20Contract: Erc20ContractHelper,
    private readonly safeDecoder: SafeDecoder,
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly proxyFactoryDecoder: ProxyFactoryDecoder,
  ) {}

  getLimitAddresses(relayPayload: RelayPayload): readonly Hex[] {
    if (this.isValidExecTransactionCall(relayPayload.to, relayPayload.data)) {
      return [relayPayload.to];
    }

    if (this.multiSendDecoder.isMultiSend(relayPayload.data)) {
      // Validity of MultiSend is part of address retrieval
      const safeAddress = this.getSafeAddressFromMultiSend(relayPayload.data);
      return [safeAddress];
    }

    if (
      this.isValidCreateProxyWithNonce(relayPayload.chainId, relayPayload.data)
    ) {
      return this.getOwnersFromCreateProxyWithNonce(relayPayload.data);
    }

    throw Error('Cannot get limit addresses – Invalid transfer');
  }

  private isValidExecTransactionCall(to: string, data: Hex): boolean {
    let execTransaction: { data: Hex; to: Hex; value: bigint };
    // If transaction is an execTransaction
    try {
      execTransaction = this.safeContract.decode(
        SafeContractHelper.EXEC_TRANSACTION,
        data,
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
      return erc20DecodedData.to !== to;
    } catch {
      // swallow exception if data is not an ERC20 transfer
    }

    // If a transaction does not target 'self' consider it valid
    if (to !== execTransaction.to) {
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

  private getSafeAddressFromMultiSend = (data: Hex): Hex => {
    // Decode transactions within MultiSend
    const transactions = this.multiSendDecoder.mapMultiSendTransactions(data);

    // Every transaction is a valid execTransaction
    const isEveryValid = transactions.every((transaction) => {
      return this.isValidExecTransactionCall(transaction.to, transaction.data);
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

  private isValidCreateProxyWithNonce(chainId: string, data: Hex): boolean {
    const isCreateProxyWithNonce = this.proxyFactoryDecoder.isFunctionCall({
      functionName: 'createProxyWithNonce',
      data,
    });

    if (!isCreateProxyWithNonce) {
      return false;
    }

    const decoded = this.proxyFactoryDecoder.decodeFunctionData({
      data,
    });
    const singleton = decoded.args[0];

    const safeL1Deployment = getSafeSingletonDeployment({
      version: LimitAddressesMapper.SUPPORTED_SAFE_VERSION,
      network: chainId,
    });
    const safeL2Deployment = getSafeL2SingletonDeployment({
      version: LimitAddressesMapper.SUPPORTED_SAFE_VERSION,
      network: chainId,
    });

    const isL1Singleton =
      safeL1Deployment?.networkAddresses[chainId] === singleton;
    const isL2Singleton =
      safeL2Deployment?.networkAddresses[chainId] === singleton;

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
