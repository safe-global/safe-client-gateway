import { Injectable } from '@nestjs/common';
import { Hex } from 'viem/src/types/misc';
import * as erc20Abi from '@openzeppelin/contracts/build/contracts/ERC20.json';
import { ContractFunctionArgsMapper } from '@/domain/relay/entities/contract-function.entity';
import { Abi, isHex } from 'viem';
import { ContractHelper } from '@/domain/relay/contracts/contract.helper';

@Injectable()
export class Erc20ContractHelper extends ContractHelper {
  protected readonly abi: readonly unknown[] | Abi = erc20Abi.abi;

  static TRANSFER: ContractFunctionArgsMapper<{ to: Hex }> = {
    name: 'transfer',
    mapper(args: readonly unknown[]): { to: Hex } {
      if (!isHex(args[0])) throw Error('transfer arg is not in hex format');
      return { to: args[0] };
    },
  };
}
