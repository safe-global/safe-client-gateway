import { Inject, Injectable, Module } from '@nestjs/common';
import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import { parseAbi, toFunctionSelector } from 'viem';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

export const abi = parseAbi([
  'function setPreSignature(bytes calldata orderUid, bool signed)',
]);

@Injectable()
export class SetPreSignatureDecoder extends AbiDecoder<typeof abi> {
  private readonly setPreSignatureFunctionSelector: `0x${string}`;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    super(abi);
    this.setPreSignatureFunctionSelector = toFunctionSelector(abi[0]);
  }

  /**
   * Checks if the provided transaction data is a setPreSignature call.
   * @param data - the transaction data
   */
  isSetPreSignature(data: string): boolean {
    return data.startsWith(this.setPreSignatureFunctionSelector);
  }

  /**
   * Gets the Order UID associated with the provided transaction data.
   *
   * @param data - the transaction data for the setPreSignature call
   * @returns {`0x${string}`} the order UID or null if the data does not represent a setPreSignature transaction
   */
  getOrderUid(data: `0x${string}`): `0x${string}` | null {
    try {
      if (!this.isSetPreSignature(data)) return null;
      const { args } = this.decodeFunctionData({ data });
      return args[0];
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }
}

@Module({
  providers: [SetPreSignatureDecoder],
  exports: [SetPreSignatureDecoder],
})
export class SetPreSignatureDecoderModule {}
