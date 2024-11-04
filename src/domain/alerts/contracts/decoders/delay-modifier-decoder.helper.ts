import { Injectable } from '@nestjs/common';
import { parseAbi } from 'viem';
import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';

export const DelayModifierAbi = parseAbi([
  'event TransactionAdded(uint256 indexed queueNonce, bytes32 indexed txHash, address to, uint256 value, bytes data, uint8 operation)',
  'function execTransactionFromModule(address to, uint256 value, bytes calldata data, uint8 operation)',
  'function executeNextTx(address to, uint256 value, bytes calldata data, uint8 operation)',
]);

@Injectable()
export class DelayModifierDecoder extends AbiDecoder<typeof DelayModifierAbi> {
  constructor() {
    super(DelayModifierAbi);
  }
}
