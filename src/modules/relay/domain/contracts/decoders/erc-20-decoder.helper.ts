import { Injectable } from '@nestjs/common';
import { erc20Abi } from 'viem';
import { AbiDecoder } from '@/modules/contracts/domain/decoders/abi-decoder.helper';

@Injectable()
export class Erc20Decoder extends AbiDecoder<typeof erc20Abi> {
  constructor() {
    super(erc20Abi);
  }
}
