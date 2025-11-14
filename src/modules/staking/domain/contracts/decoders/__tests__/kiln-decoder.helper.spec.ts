import {
  batchWithdrawCLFeeEncoder,
  depositEncoder,
  depositEventEventBuilder,
  requestValidatorsExitEncoder,
  withdrawalEventBuilder,
} from '@/modules/staking/domain/contracts/decoders/__tests__/encoders/kiln-encoder.builder';
import { KilnDecoder } from '@/modules/staking/domain/contracts/decoders/kiln-decoder.helper';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import type { Address, Hex } from 'viem';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('KilnDecoder', () => {
  let kilnDecoder: KilnDecoder;

  beforeEach(() => {
    kilnDecoder = new KilnDecoder(mockLoggingService);
  });

  describe('decodeValidatorsExit', () => {
    it('decodes a requestValidatorsExit function call correctly', () => {
      const requestValidatorsExist = requestValidatorsExitEncoder();
      const { _publicKeys } = requestValidatorsExist.build();
      const data = requestValidatorsExist.encode();
      expect(kilnDecoder.decodeValidatorsExit(data)).toEqual(_publicKeys);
    });

    it('returns null if the data is not a requestValidatorsExit function call', () => {
      const data = faker.string.hexadecimal({ length: 1 }) as Address;
      expect(kilnDecoder.decodeValidatorsExit(data)).toBeNull();
    });

    it('returns null if the data is another Kiln function call', () => {
      const data = depositEncoder().encode();
      expect(kilnDecoder.decodeValidatorsExit(data)).toBeNull();
    });
  });

  describe('decodeBatchWithdrawCLFee', () => {
    it('decodes a batchWithdrawCLFee function call correctly', () => {
      const decodeBatchWithdrawCLFee = batchWithdrawCLFeeEncoder();
      const { _publicKeys } = decodeBatchWithdrawCLFee.build();
      const data = decodeBatchWithdrawCLFee.encode();
      expect(kilnDecoder.decodeBatchWithdrawCLFee(data)).toEqual(_publicKeys);
    });

    it('returns null if the data is not a batchWithdrawCLFee function call', () => {
      const data = faker.string.hexadecimal({ length: 1 }) as Address;
      expect(kilnDecoder.decodeBatchWithdrawCLFee(data)).toBeNull();
    });

    it('returns null if the data is another Kiln function call', () => {
      const data = depositEncoder().encode();
      expect(kilnDecoder.decodeBatchWithdrawCLFee(data)).toBeNull();
    });
  });

  describe('decodeDepositEvent', () => {
    it('decodes a DepositEvent correctly', () => {
      const depositEventEvent = depositEventEventBuilder();
      const { data, topics } = depositEventEvent.encode();

      expect(
        kilnDecoder.decodeDepositEvent({
          data,
          topics,
        }),
      ).toStrictEqual(depositEventEvent.build());
    });

    it('returns null if the data is not a DepositEvent', () => {
      const { data, topics } = withdrawalEventBuilder().encode();

      expect(kilnDecoder.decodeDepositEvent({ data, topics })).toBe(null);
    });

    it('returns null if the data is not a DepositEvent', () => {
      const data = faker.string.hexadecimal({ length: 514 }) as Hex;
      const topics = [faker.string.hexadecimal({ length: 64 }) as Hex] as [
        signature: Hex,
        ...args: Array<Address>,
      ];

      expect(kilnDecoder.decodeDepositEvent({ data, topics })).toBe(null);
    });
  });

  describe('decodeWithdrawalEvent', () => {
    it('decodes a Withdrawal correctly', () => {
      const withdrawalEvent = withdrawalEventBuilder();
      const { data, topics } = withdrawalEvent.encode();

      expect(
        kilnDecoder.decodeWithdrawal({
          data,
          topics,
        }),
      ).toStrictEqual(withdrawalEvent.build());
    });

    it('returns null if the data is not a Withdrawal', () => {
      const { data, topics } = depositEventEventBuilder().encode();

      expect(kilnDecoder.decodeWithdrawal({ data, topics })).toBe(null);
    });

    it('returns null if the data is not a Withdrawal', () => {
      const data = faker.string.hexadecimal({ length: 514 }) as Hex;
      const topics = [faker.string.hexadecimal({ length: 64 }) as Hex] as [
        signature: Hex,
        ...args: Array<Address>,
      ];

      expect(kilnDecoder.decodeWithdrawal({ data, topics })).toBe(null);
    });
  });
});
