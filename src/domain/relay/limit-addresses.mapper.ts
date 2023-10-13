import { Inject, Injectable } from '@nestjs/common';
import { Hex } from 'viem/types/misc';
import { Erc20ContractHelper } from '@/domain/relay/contracts/erc20-contract.helper';
import { SafeContractHelper } from '@/domain/relay/contracts/safe-contract.helper';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

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
  ) {}

  getLimitAddresses(relayPayload: RelayPayload): Hex[] {
    if (this.isValidExecTransactionCall(relayPayload.to, relayPayload.data)) {
      return [relayPayload.to];
    }

    // TODO Handle Multisend

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
}
