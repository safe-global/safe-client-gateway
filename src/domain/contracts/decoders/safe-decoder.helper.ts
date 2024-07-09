import { Inject, Injectable } from '@nestjs/common';
import Safe130 from '@/abis/safe/v1.3.0/GnosisSafe.abi';
import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import { Hex, decodeFunctionData } from 'viem';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';

@Injectable()
export class SafeDecoder extends AbiDecoder<typeof Safe130> {
  constructor(
    @Inject(LoggingService) readonly loggingService: ILoggingService,
  ) {
    super(loggingService, Safe130);
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
