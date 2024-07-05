import { toHex } from 'viem';
import { faker } from '@faker-js/faker';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/decoders/delay-modifier-decoder.helper';
import { transactionAddedEventBuilder } from '@/domain/alerts/contracts/__tests__/encoders/delay-modifier-encoder.builder';

describe('DelayModifierDecoder', () => {
  let target: DelayModifierDecoder;

  beforeEach(() => {
    jest.resetAllMocks();
    target = new DelayModifierDecoder();
  });

  it('decodes a TransactionAdded event correctly', () => {
    const transactionAddedEvent = transactionAddedEventBuilder();
    const { data, topics } = transactionAddedEvent.encode();

    expect(target.decodeEventLog.TransactionAdded({ data, topics })).toEqual(
      transactionAddedEvent.build(),
    );
  });

  it('returns null if the event cannot be decoded', () => {
    const data = toHex(faker.string.hexadecimal({ length: 514 }));

    expect(
      target.decodeEventLog.TransactionAdded({ data, topics: [] }),
    ).toEqual(null);
  });
});
