import { Injectable } from '@nestjs/common';
import { parseAbi } from 'viem';
import { AbiDecoder } from '@/domain/alerts/contracts/abi-decoder.helper';

const OWNER_MANAGER_ABI = parseAbi([
  'function addOwnerWithThreshold(address owner, uint256 _threshold)',
  'function removeOwner(address prevOwner, address owner, uint256 _threshold)',
  'function swapOwner(address prevOwner, address oldOwner, address newOwner)',
  'function changeThreshold(uint256 _threshold)',
]);

@Injectable()
export class SafeDecoder extends AbiDecoder<typeof OWNER_MANAGER_ABI> {
  constructor() {
    super(OWNER_MANAGER_ABI);
  }
}
