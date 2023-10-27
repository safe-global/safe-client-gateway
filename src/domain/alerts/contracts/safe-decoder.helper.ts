import { Injectable } from '@nestjs/common';
import { parseAbi } from 'viem';
import { AbiDecoder } from '@/domain/alerts/contracts/abi-decoder.helper';

const ADD_OWNER_WITH_THRESHOLD_ABI = parseAbi([
  'function addOwnerWithThreshold(address owner, uint256 _threshold)',
]);

@Injectable()
export class SafeDecoder extends AbiDecoder<
  typeof ADD_OWNER_WITH_THRESHOLD_ABI
> {
  constructor() {
    super(ADD_OWNER_WITH_THRESHOLD_ABI);
  }
}
