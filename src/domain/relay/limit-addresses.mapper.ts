import { Inject, Injectable } from '@nestjs/common';
import { Hex } from 'viem/types/misc';
import { Erc20ContractHelper } from '@/domain/relay/contracts/erc20-contract.helper';
import { SafeContractHelper } from '@/domain/relay/contracts/safe-contract.helper';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { MultiSendDecoder } from '@/domain/alerts/contracts/multi-send-decoder.helper';

export interface RelayPayload {
  chainId: string;
  data: Hex;
  to: Hex;
  gasLimit: bigint;
}

@Injectable()
export class LimitAddressesMapper {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    private readonly safeContract: SafeContractHelper,
    private readonly erc20Contract: Erc20ContractHelper,
    private readonly multiSendDecoder: MultiSendDecoder,
  ) {}

  getLimitAddresses(relayPayload: RelayPayload): Hex[] {
    if (this.isValidExecTransactionCall(relayPayload.to, relayPayload.data)) {
      return [relayPayload.to];
    }

    if (this.isMultiSend(relayPayload.data)) {
      // Validity of MultiSend is part of address retrieval
      const safeAddress = this.getSafeAddressFromMultiSend(relayPayload.data);
      return [safeAddress];
    }

    // TODO Handle create proxy with nonce

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

  private isMultiSend(data: Hex): boolean {
    return this.multiSendDecoder.isFunctionCall({
      functionName: 'multiSend',
      data,
    });
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

    // Every transaction is 'self' (the Safe)
    const isSameRecipient = transactions.every((transaction) => {
      return transaction.to === firstRecipient;
    });

    if (!isSameRecipient) {
      throw Error('MultiSend transactions target different addresses');
    }

    return firstRecipient;
  };
}
