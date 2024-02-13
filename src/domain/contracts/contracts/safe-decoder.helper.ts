import { Injectable } from '@nestjs/common';
import { parseAbi } from 'viem';
import { AbiDecoder } from '@/domain/contracts/contracts/abi-decoder.helper';

const SAFE_ABI = parseAbi([
  'function setup(address[] calldata _owners, uint256 _threshold, address to, bytes calldata data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)',
  // Owner management
  'function addOwnerWithThreshold(address owner, uint256 _threshold)',
  'function removeOwner(address prevOwner, address owner, uint256 _threshold)',
  'function swapOwner(address prevOwner, address oldOwner, address newOwner)',
  'function changeThreshold(uint256 _threshold)',
  'function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)',
]);

@Injectable()
export class SafeDecoder extends AbiDecoder<typeof SAFE_ABI> {
  constructor() {
    super(SAFE_ABI);
  }
}
