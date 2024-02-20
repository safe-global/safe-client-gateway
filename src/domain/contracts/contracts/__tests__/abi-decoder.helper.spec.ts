import { faker } from '@faker-js/faker';
import { Hex, encodeFunctionData, parseAbi } from 'viem';
import { _generateHelpers } from '@/domain/contracts/contracts/abi-decoder.helper';

describe('AbiDecoder', () => {
  describe('generateHelpers', () => {
    it('should generate helpers', () => {
      const abi = parseAbi(['function example()', 'function example2()']);

      const helpers = _generateHelpers(abi);

      expect(helpers.isExample).toBeDefined();
      expect(helpers.isExample2).toBeDefined();
    });

    it('should not generate helpers for non-function types', () => {
      const abi = parseAbi(['event example()', 'function example2()']);

      const helpers = _generateHelpers(abi);

      // @ts-expect-error - isExample is not defined
      expect(helpers.isExample).not.toBeDefined();
      expect(helpers.isExample2).toBeDefined();
    });

    it('should return true if the data is of the method', () => {
      const abi = parseAbi(['function example()']);
      const data = encodeFunctionData({
        abi,
        functionName: 'example',
      });

      const helpers = _generateHelpers(abi);

      expect(helpers.isExample(data)).toBe(true);
    });

    it('should return false if the data is not of the method', () => {
      const abi = parseAbi(['function example()']);
      const data = faker.string.hexadecimal() as Hex;

      const helpers = _generateHelpers(abi);

      expect(helpers.isExample(data)).toBe(false);
    });
  });
});
