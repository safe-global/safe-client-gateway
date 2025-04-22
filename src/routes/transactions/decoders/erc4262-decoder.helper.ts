import { Injectable } from '@nestjs/common';
import { erc4626Abi } from 'viem';
import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';

@Injectable()
export class Erc4262Decoder extends AbiDecoder<typeof erc4626Abi> {
  constructor() {
    super(erc4626Abi);
  }
}
