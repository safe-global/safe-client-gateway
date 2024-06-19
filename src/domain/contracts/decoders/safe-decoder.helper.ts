import { Injectable } from '@nestjs/common';
import Safe130 from '@/abis/safe/v1.3.0/GnosisSafe.abi';
import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import { Hex, decodeFunctionData } from 'viem';

@Injectable()
export class SafeDecoder extends AbiDecoder<typeof Safe130> {
  constructor() {
    super(Safe130);
  }

  isCall(data: Hex): boolean {
    try {
      decodeFunctionData({ abi: this.abi, data });
      return true;
    } catch {
      return false;
    }
  }
}
