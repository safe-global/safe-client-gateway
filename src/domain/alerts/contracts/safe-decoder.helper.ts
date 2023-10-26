import { Inject, Injectable } from '@nestjs/common';
import { parseAbi } from 'viem';
import { AbiDecoder } from '@/domain/alerts/contracts/abi-decoder.helper';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';

const ADD_OWNER_WITH_THRESHOLD_ABI = parseAbi([
  'function addOwnerWithThreshold(address owner, uint256 _threshold)',
]);

@Injectable()
export class SafeDecoder extends AbiDecoder<
  typeof ADD_OWNER_WITH_THRESHOLD_ABI
> {
  constructor(@Inject(LoggingService) loggingService: ILoggingService) {
    super(loggingService, ADD_OWNER_WITH_THRESHOLD_ABI);
  }
}
