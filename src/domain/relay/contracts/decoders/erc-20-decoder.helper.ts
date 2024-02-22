import { Injectable } from '@nestjs/common';
import { erc20Abi } from 'viem';
import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';

@Injectable()
export class Erc20Decoder extends AbiDecoder<typeof erc20Abi> {
  constructor() {
    super(erc20Abi);
  }
}
