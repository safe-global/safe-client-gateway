import { Injectable } from '@nestjs/common';
import { getSafeSingletonDeployment } from '@safe-global/safe-deployments';
import { Abi, isHex } from 'viem';
import { Hex } from 'viem/types/misc';
import { ContractFunctionArgsMapper } from '@/domain/relay/entities/contract-function.entity';
import { ContractHelper } from '@/domain/relay/contracts/contract.helper';

@Injectable()
export class SafeContractHelper extends ContractHelper {
  protected readonly abi: readonly unknown[] | Abi;

  private static SUPPORTED_SAFE_VERSION = '1.3.0';

  static EXEC_TRANSACTION: ContractFunctionArgsMapper<{
    data: Hex;
    to: Hex;
    value: bigint;
  }> = {
    name: 'execTransaction',
    mapper(args: readonly unknown[]): { data: Hex; to: Hex; value: bigint } {
      if (!isHex(args[2]) || !isHex(args[0]) || typeof args[1] !== 'bigint')
        throw Error('Unexpected type for execTransaction args');
      return { data: args[2], to: args[0], value: args[1] };
    },
  };

  constructor() {
    super();
    const safeDeployment = getSafeSingletonDeployment({
      version: SafeContractHelper.SUPPORTED_SAFE_VERSION,
    });
    if (!safeDeployment) throw Error('Safe deployment is undefined');
    this.abi = safeDeployment.abi;
  }
}
