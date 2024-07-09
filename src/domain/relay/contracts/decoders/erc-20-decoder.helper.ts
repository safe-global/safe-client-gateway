import { Inject, Injectable } from '@nestjs/common';
import { erc20Abi } from 'viem';
import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';

@Injectable()
export class Erc20Decoder extends AbiDecoder<typeof erc20Abi> {
  constructor(
    @Inject(LoggingService) readonly loggingService: ILoggingService,
  ) {
    super(loggingService, erc20Abi);
  }
}
