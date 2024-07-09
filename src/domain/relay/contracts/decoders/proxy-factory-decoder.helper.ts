import { Inject, Injectable } from '@nestjs/common';
import ProxyFactory130 from '@/abis/safe/v1.3.0/GnosisSafeProxyFactory.abi';
import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';

@Injectable()
export class ProxyFactoryDecoder extends AbiDecoder<typeof ProxyFactory130> {
  constructor(
    @Inject(LoggingService) readonly loggingService: ILoggingService,
  ) {
    super(loggingService, ProxyFactory130);
  }
}
