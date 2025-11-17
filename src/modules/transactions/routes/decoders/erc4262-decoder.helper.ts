import { Injectable } from '@nestjs/common';
import { erc4626Abi } from 'viem';
import { AbiDecoder } from '@/modules/contracts/domain/decoders/abi-decoder.helper';

@Injectable()
export class Erc4262Decoder extends AbiDecoder<typeof erc4626Abi> {
  constructor() {
    super(erc4626Abi);
  }
}
