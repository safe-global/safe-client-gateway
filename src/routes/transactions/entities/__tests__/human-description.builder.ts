import { Builder, IBuilder } from '@/__tests__/builder';
import {
  RichAddressFragment,
  RichHumanDescriptionFragment,
  RichNumberFragment,
  RichTokenValueFragment,
  RichTextFragment,
} from '@/routes/transactions/entities/human-description.entity';
import { ValueType } from '@/domain/human-description/entities/human-description.entity';
import { faker } from '@faker-js/faker';

function richTokenValueFragmentBuilder(): IBuilder<RichTokenValueFragment> {
  return Builder.new<RichTokenValueFragment>()
    .with('type', ValueType.TokenValue)
    .with('value', faker.word.noun())
    .with('richData', {
      symbol: faker.word.noun(),
      logoUri: faker.internet.avatar(),
    });
}

function richWordFragmentBuilder(): IBuilder<RichTextFragment> {
  return Builder.new<RichTextFragment>()
    .with('type', ValueType.Text)
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
  | (() => IBuilder<RichTextFragment>)
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
