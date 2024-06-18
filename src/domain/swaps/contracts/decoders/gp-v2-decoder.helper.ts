import { Inject, Injectable, Module } from '@nestjs/common';
import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import { parseAbi } from 'viem';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

export const abi = parseAbi([
  'function setPreSignature(bytes calldata orderUid, bool signed)',
]);

@Injectable()
export class GPv2Decoder extends AbiDecoder<typeof abi> {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    super(abi);
  }

  /**
   * Gets the Order UID associated with the provided transaction data.
   *
   * @param data - the transaction data for the setPreSignature call
   * @returns {`0x${string}`} the order UID or null if the data does not represent a setPreSignature transaction
   */
  getOrderUid(data: `0x${string}`): `0x${string}` | null {
    try {
      if (!this.helpers.isSetPreSignature(data)) return null;
      const { args } = this.decodeFunctionData({ data });
      return args[0];
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }
}

@Module({
  providers: [GPv2Decoder],
  exports: [GPv2Decoder],
})
export class GPv2DecoderModule {}
