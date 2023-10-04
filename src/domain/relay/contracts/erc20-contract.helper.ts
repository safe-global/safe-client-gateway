import { Injectable } from '@nestjs/common';
import { Hex } from 'viem/types/misc';
import { ContractFunctionArgsMapper } from '@/domain/relay/entities/contract-function.entity';
import { Abi, isHex } from 'viem';
import { ContractHelper } from '@/domain/relay/contracts/contract.helper';

// Consider adding @openzeppelin/contracts if we need to support more ERC-20 token functions
const TRANSFER_ABI: readonly unknown[] | Abi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'transfer',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

@Injectable()
export class Erc20ContractHelper extends ContractHelper {
  protected readonly abi: readonly unknown[] | Abi = TRANSFER_ABI;

  static TRANSFER: ContractFunctionArgsMapper<{ to: Hex }> = {
    name: 'transfer',
    mapper(args: readonly unknown[]): { to: Hex } {
      if (!isHex(args[0])) throw Error('transfer arg is not in hex format');
      return { to: args[0] };
    },
  };
}
