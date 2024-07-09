import { SafeDecoder } from '@/domain/contracts/decoders/safe-decoder.helper';
import {
  addOwnerWithThresholdEncoder,
  changeThresholdEncoder,
  execTransactionEncoder,
  removeOwnerEncoder,
  setupEncoder,
  swapOwnerEncoder,
} from '@/domain/contracts/__tests__/encoders/safe-encoder.builder';
import { ILoggingService } from '@/logging/logging.interface';

const mockLoggingService = {
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('SafeDecoder', () => {
  let target: SafeDecoder;

  beforeEach(() => {
    jest.resetAllMocks();
    target = new SafeDecoder(mockLoggingService);
  });

  describe('decodeFunctionData', () => {
    it('decodes a setup function call correctly', () => {
      const setup = setupEncoder();
      const args = setup.build();
      const data = setup.encode();

      expect(target.decodeFunctionData.setup(data)).toEqual([
        args.owners,
        args.threshold,
        args.to,
        args.data,
        args.fallbackHandler,
        args.paymentToken,
        args.payment,
        args.paymentReceiver,
      ]);
    });

    it('decodes an addOwnerWithThreshold function call correctly', () => {
      const addOwnerWithThreshold = addOwnerWithThresholdEncoder();
      const args = addOwnerWithThreshold.build();
      const data = addOwnerWithThreshold.encode();

      expect(target.decodeFunctionData.addOwnerWithThreshold(data)).toEqual([
        args.owner,
        args.threshold,
      ]);
    });

    it('decodes a removeOwner function call correctly', () => {
      const removeOwner = removeOwnerEncoder();
      const args = removeOwner.build();
      const data = removeOwner.encode();

      expect(target.decodeFunctionData.removeOwner(data)).toEqual([
        args.prevOwner,
        args.owner,
        args.threshold,
      ]);
    });

    it('decodes a swapOwner function call correctly', () => {
      const swapOwner = swapOwnerEncoder();
      const args = swapOwner.build();
      const data = swapOwner.encode();

      expect(target.decodeFunctionData.swapOwner(data)).toEqual([
        args.prevOwner,
        args.oldOwner,
        args.newOwner,
      ]);
    });

    it('decodes a changeThreshold function call correctly', () => {
      const changeThreshold = changeThresholdEncoder();
      const args = changeThreshold.build();
      const data = changeThreshold.encode();

      expect(target.decodeFunctionData.changeThreshold(data)).toEqual([
        args.threshold,
      ]);
    });

    it('decodes an execTransaction function call correctly', () => {
      const execTransaction = execTransactionEncoder();
      const args = execTransaction.build();
      const data = execTransaction.encode();

      expect(target.decodeFunctionData.execTransaction(data)).toEqual([
        args.to,
        args.value,
        args.data,
        args.operation,
        args.safeTxGas,
        args.baseGas,
        args.gasPrice,
        args.gasToken,
        args.refundReceiver,
        args.signatures,
      ]);
    });
  });

  describe('isCall', () => {
    it('returns true if the data is a valid function call', () => {
      [
        setupEncoder,
        addOwnerWithThresholdEncoder,
        removeOwnerEncoder,
        swapOwnerEncoder,
        changeThresholdEncoder,
      ].forEach((encoder) => {
        const data = encoder().encode();

        expect(target.isCall(data)).toBe(true);
      });
    });

    it('returns false if the data is not a valid function call', () => {
      const data = '0x';

      expect(target.isCall(data)).toBe(false);
    });
  });
});
