import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { tokenBuilder } from '@/domain/bridge/entities/__tests__/token.builder';
import { stepBuilder } from '@/domain/bridge/entities/__tests__/bridge-step.builder';
import { Builder } from '@/__tests__/builder';
import { OrderTypes } from '@/domain/bridge/entities/bridge-route.entity';
import type { BridgeRoute } from '@/domain/bridge/entities/bridge-route.entity';
import type { IBuilder } from '@/__tests__/builder';

export function routeBuilder<T extends BridgeRoute>(): IBuilder<T> {
  return new Builder<T>()
    .with('id', faker.string.uuid())
    .with('fromChainId', faker.string.numeric())
    .with(
      'fromAmountUSD',
      faker.number.float({ min: 0, max: 1_000 }).toString(),
    )
    .with('fromAmount', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('fromToken', tokenBuilder().build())
    .with('fromAddress', getAddress(faker.finance.ethereumAddress()))
    .with('toChainId', faker.string.numeric())
    .with('toAmountUSD', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('toAmount', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('toAmountMin', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('toToken', tokenBuilder().build())
    .with('toAddress', getAddress(faker.finance.ethereumAddress()))
    .with('gasCostUSD', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('containsSwitchChain', faker.datatype.boolean())
    .with(
      'steps',
      faker.helpers.multiple(() => stepBuilder().build(), {
        count: faker.number.int({ min: 1, max: 5 }),
      }),
    )
    .with('tags', [...OrderTypes]);
}
