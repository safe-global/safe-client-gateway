import { Injectable } from '@nestjs/common';
import { parseAbi } from 'viem';
import { AbiDecoder } from '@/domain/alerts/contracts/abi-decoder.helper';

const PROXY_FACTORY_ABI = parseAbi([
  'function createProxyWithNonce(address _singleton, bytes memory initializer, uint256 saltNonce)',
]);

@Injectable()
export class ProxyFactoryDecoder extends AbiDecoder<typeof PROXY_FACTORY_ABI> {
  constructor() {
    super(PROXY_FACTORY_ABI);
  }
}
