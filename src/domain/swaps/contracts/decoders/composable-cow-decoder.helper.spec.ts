import {
  conditionalOrderParamsBuilder,
  createWithContextEncoder,
  staticInputEncoder,
} from '@/domain/swaps/contracts/__tests__/encoders/composable-cow-encoder.builder';
import { ComposableCowDecoder } from '@/domain/swaps/contracts/decoders/composable-cow-decoder.helper';

describe('ComposableCowDecoder', () => {
  const target = new ComposableCowDecoder();

  describe('decodeTwapStruct', () => {
    it('should decode a createWithContext call', () => {
      const staticInput = staticInputEncoder();
      const conditionalOrderParams = conditionalOrderParamsBuilder()
        .with('staticInput', staticInput.encode())
        // TWAP handler address
        .with('handler', '0x6cF1e9cA41f7611dEf408122793c358a3d11E5a5')
        .build();
      const createWithContext = createWithContextEncoder().with(
        'params',
        conditionalOrderParams,
      );
      const data = createWithContext.encode();

      const result = target.decodeTwapStruct(data);

      expect(result).toStrictEqual(staticInput.build());
    });

    it('should throw if TWAP handler is invalid', () => {
      const data = createWithContextEncoder().encode();

      expect(() => target.decodeTwapStruct(data)).toThrow(
        'Invalid TWAP handler',
      );
    });
  });
});
