import { Injectable } from '@nestjs/common';
import Safe130 from '@/dist/abis/safe/v1.3.0/GnosisSafe.abi';
import { AbiDecoder } from '@/domain/contracts/contracts/abi-decoder.helper';

@Injectable()
export class SafeDecoder extends AbiDecoder<typeof Safe130> {
  constructor() {
    super(Safe130);
  }
}
