import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/__tests__/encoders/multi-send-encoder.builder';
import {
  batchWithdrawCLFeeEncoder,
  depositEncoder,
  requestValidatorsExitEncoder,
} from '@/domain/staking/contracts/decoders/__tests__/encoders/kiln-encoder.builder';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import type { ILoggingService } from '@/logging/logging.interface';
import { KilnNativeStakingHelper } from '@/routes/transactions/helpers/kiln-native-staking.helper';
import { TransactionFinder } from '@/routes/transactions/helpers/transaction-finder.helper';
import { faker } from '@faker-js/faker';
import { concat, getAddress } from 'viem';

const mockLoggingService = {
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('KilnNativeStakingHelper', () => {
  let target: KilnNativeStakingHelper;

  beforeEach(() => {
    jest.resetAllMocks();

    const multiSendDecoder = new MultiSendDecoder(mockLoggingService);
    const transactionFinder = new TransactionFinder(multiSendDecoder);
    target = new KilnNativeStakingHelper(transactionFinder);
  });

  describe.each([
    { name: 'findDepositTransaction', encoder: depositEncoder } as const,
    {
      name: 'findValidatorsExitTransaction',
      encoder: requestValidatorsExitEncoder,
    } as const,
    {
      name: 'findWithdrawTransaction',
      encoder: batchWithdrawCLFeeEncoder,
    } as const,
  ])('$name', ({ name, encoder }) => {
    it('should return a transaction', () => {
      const to = getAddress(faker.finance.ethereumAddress());
      const data = encoder().encode();
      const value = faker.string.numeric();

      const result = target[name]({
        to,
        data,
        value,
      });

      expect(result).toStrictEqual({ to, data, value });
    });

    it('should return a batched transaction', () => {
      const depositTo = getAddress(faker.finance.ethereumAddress());
      const depositData = encoder().encode();
      const depositValue = faker.number.bigInt();
      const multiSendTo = getAddress(faker.finance.ethereumAddress());
      const mulitSendData = multiSendEncoder()
        .with(
          'transactions',
          multiSendTransactionsEncoder([
            {
              operation: 0,
              data: depositData,
              to: depositTo,
              value: depositValue,
            },
          ]),
        )
        .encode();

      const result = target[name]({
        to: multiSendTo,
        data: mulitSendData,
        value: faker.string.numeric(),
      });

      expect(result).toStrictEqual({
        to: depositTo,
        data: depositData,
        value: depositValue.toString(),
      });
    });
  });

  describe('splitPublicKeys', () => {
    it('should split the _publicKeys into an array of strings of correct length', () => {
      const validators = [
        faker.string.hexadecimal({
          length: KilnDecoder.KilnPublicKeyLength,
          casing: 'lower',
        }),
        faker.string.hexadecimal({
          length: KilnDecoder.KilnPublicKeyLength,
          casing: 'lower',
        }),
        faker.string.hexadecimal({
          length: KilnDecoder.KilnPublicKeyLength,
          casing: 'lower',
        }),
      ] as Array<`0x${string}`>;
      const _publicKeys = concat(validators);

      const result = target.splitPublicKeys(_publicKeys);

      expect(result).toStrictEqual(validators);
    });
  });
});
