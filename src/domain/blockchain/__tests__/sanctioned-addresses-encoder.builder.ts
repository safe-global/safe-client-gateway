import { Builder } from '@/__tests__/builder';
import { IEncoder } from '@/__tests__/encoder-builder';
import { faker } from '@faker-js/faker';
import {
  parseAbi,
  encodeEventTopics,
  encodeAbiParameters,
  parseAbiParameters,
  getAddress,
} from 'viem';

// SanctionedAddressesAdded

type SanctionedAddressesAddedEventArgs = {
  addrs: Array<`0x${string}`>;
};

type SanctionedAddressesAddedEvent = {
  data: `0x${string}`;
  topics: [signature: `0x${string}`, ...args: Array<`0x${string}`>];
};

class SanctionedAddressesAddedEventBuilder<
    T extends SanctionedAddressesAddedEventArgs,
  >
  extends Builder<T>
  implements IEncoder<SanctionedAddressesAddedEvent>
{
  static readonly NON_INDEXED_PARAMS = 'address[] addrs' as const;
  static readonly EVENT_SIGNATURE =
    `event SanctionedAddressesAdded(${SanctionedAddressesAddedEventBuilder.NON_INDEXED_PARAMS})` as const;

  encode(): SanctionedAddressesAddedEvent {
    const abi = parseAbi([
      SanctionedAddressesAddedEventBuilder.EVENT_SIGNATURE,
    ]);

    const args = this.build();

    const data = encodeAbiParameters(
      parseAbiParameters(
        SanctionedAddressesAddedEventBuilder.NON_INDEXED_PARAMS,
      ),
      [args.addrs],
    );

    const topics = encodeEventTopics({
      abi,
      eventName: 'SanctionedAddressesAdded',
      args: {
        addrs: args.addrs,
      },
    }) as SanctionedAddressesAddedEvent['topics'];

    return {
      data,
      topics,
    };
  }
}

export function sanctionedAddressesAddedEventBuilder(): SanctionedAddressesAddedEventBuilder<SanctionedAddressesAddedEventArgs> {
  return new SanctionedAddressesAddedEventBuilder().with('addrs', [
    getAddress(faker.finance.ethereumAddress()),
  ]);
}

// SanctionedAddressesRemoved

type SanctionedAddressesRemovedEventArgs = {
  addrs: Array<`0x${string}`>;
};

type SanctionedAddressesRemovedEvent = {
  data: `0x${string}`;
  topics: [signature: `0x${string}`, ...args: Array<`0x${string}`>];
};

class SanctionedAddressesRemovedEventBuilder<
    T extends SanctionedAddressesRemovedEventArgs,
  >
  extends Builder<T>
  implements IEncoder<SanctionedAddressesRemovedEvent>
{
  static readonly NON_INDEXED_PARAMS = 'address[] addrs' as const;
  static readonly EVENT_SIGNATURE =
    `event SanctionedAddressesRemoved(${SanctionedAddressesRemovedEventBuilder.NON_INDEXED_PARAMS})` as const;

  encode(): SanctionedAddressesRemovedEvent {
    const abi = parseAbi([
      SanctionedAddressesRemovedEventBuilder.EVENT_SIGNATURE,
    ]);

    const args = this.build();

    const data = encodeAbiParameters(
      parseAbiParameters(
        SanctionedAddressesRemovedEventBuilder.NON_INDEXED_PARAMS,
      ),
      [args.addrs],
    );

    const topics = encodeEventTopics({
      abi,
      eventName: 'SanctionedAddressesRemoved',
      args: {
        addrs: args.addrs,
      },
    }) as SanctionedAddressesRemovedEvent['topics'];

    return {
      data,
      topics,
    };
  }
}

export function sanctionedAddressesRemovedEventBuilder(): SanctionedAddressesRemovedEventBuilder<SanctionedAddressesRemovedEventArgs> {
  return new SanctionedAddressesRemovedEventBuilder().with('addrs', [
    getAddress(faker.finance.ethereumAddress()),
  ]);
}
