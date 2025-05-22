import { faker } from '@faker-js/faker';
import { Builder } from '@/__tests__/builder';
import { GasCostTypes } from '@/domain/bridge/entities/bridge-quote.entity';
import { tokenBuilder } from '@/domain/bridge/entities/__tests__/token.builder';
import { stepBuilder } from '@/domain/bridge/entities/__tests__/bridge-step.builder';
import type { IBuilder } from '@/__tests__/builder';
import type {
  BridgeQuote,
  GasCost,
} from '@/domain/bridge/entities/bridge-quote.entity';

export function gasCostBuilder(): IBuilder<GasCost> {
  return new Builder<GasCost>()
    .with('type', faker.helpers.arrayElement(GasCostTypes))
    .with('price', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('estimate', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('limit', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('amount', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('amountUSD', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('token', tokenBuilder().build());
}

export function bridgeQuoteBuilder(): IBuilder<BridgeQuote> {
  const step = stepBuilder().build();
  const builder = new Builder<BridgeQuote>();

  for (const key of Object.keys(step)) {
    if (key !== 'type') {
      const _key = key as keyof typeof step;
      builder.with(_key, step[_key]);
    }
  }

  return builder.with('type', 'lifi').with(
    'includedSteps',
    faker.helpers.multiple(() => stepBuilder().build(), {
      count: { min: 1, max: 5 },
    }),
  );
}
