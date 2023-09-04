import { Builder, IBuilder } from '@/__tests__/builder';
import {
  RichAddressFragment,
  RichHumanDescriptionFragment,
  RichNumberFragment,
  RichTokenValueFragment,
  RichWordFragment,
} from '@/routes/transactions/entities/human-description.entity';
import { ValueType } from '@/domain/human-description/entities/human-description.entity';
import { faker } from '@faker-js/faker';

function richTokenValueFragmentBuilder(): IBuilder<RichTokenValueFragment> {
  return Builder.new<RichTokenValueFragment>()
    .with('type', ValueType.TokenValue)
    .with('value', faker.word.noun())
    .with('symbol', faker.word.noun())
    .with('logoUri', faker.internet.avatar());
}

function richWordFragmentBuilder(): IBuilder<RichWordFragment> {
  return Builder.new<RichWordFragment>()
    .with('type', ValueType.Word)
    .with('value', faker.word.adverb());
}

function richAddressFragmentBuilder(): IBuilder<RichAddressFragment> {
  return Builder.new<RichAddressFragment>()
    .with('type', ValueType.Address)
    .with('value', faker.finance.ethereumAddress() as `0x${string}`);
}

function richNumberFragmentBuilder(): IBuilder<RichNumberFragment> {
  return Builder.new<RichNumberFragment>()
    .with('type', ValueType.Number)
    .with('value', faker.number.bigInt());
}

const humanDescriptionBuilders: Array<
  | (() => IBuilder<RichTokenValueFragment>)
  | (() => IBuilder<RichWordFragment>)
  | (() => IBuilder<RichAddressFragment>)
  | (() => IBuilder<RichNumberFragment>)
> = [
  richTokenValueFragmentBuilder,
  richWordFragmentBuilder,
  richAddressFragmentBuilder,
  richNumberFragmentBuilder,
];

export function buildHumanDescription(): RichHumanDescriptionFragment[] {
  return Array.from({ length: faker.number.int({ min: 0, max: 6 }) }, () =>
    faker.helpers.arrayElement(humanDescriptionBuilders)().build(),
  );
}
