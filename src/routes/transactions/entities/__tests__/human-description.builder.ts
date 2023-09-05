import { Builder, IBuilder } from '@/__tests__/builder';
import {
  RichAddressFragment,
  RichTokenValueFragment,
  RichTextFragment,
  RichDecodedInfoFragment,
  RichFragmentType,
} from '@/routes/transactions/entities/human-description.entity';
import { faker } from '@faker-js/faker';

function richTokenValueFragmentBuilder(): IBuilder<RichTokenValueFragment> {
  return Builder.new<RichTokenValueFragment>()
    .with('type', RichFragmentType.TokenValue)
    .with('value', faker.number.int().toString())
    .with('symbol', faker.finance.currencySymbol())
    .with('logoUri', faker.internet.avatar());
}

function richWordFragmentBuilder(): IBuilder<RichTextFragment> {
  return Builder.new<RichTextFragment>()
    .with('type', RichFragmentType.Text)
    .with('value', faker.word.adverb());
}

function richAddressFragmentBuilder(): IBuilder<RichAddressFragment> {
  return Builder.new<RichAddressFragment>()
    .with('type', RichFragmentType.Address)
    .with('value', faker.finance.ethereumAddress() as `0x${string}`);
}

const humanDescriptionBuilders: Array<() => IBuilder<RichDecodedInfoFragment>> =
  [
    richTokenValueFragmentBuilder,
    richWordFragmentBuilder,
    richAddressFragmentBuilder,
  ];

export function buildHumanDescription(): RichDecodedInfoFragment[] {
  return Array.from({ length: faker.number.int({ min: 0, max: 6 }) }, () =>
    faker.helpers.arrayElement(humanDescriptionBuilders)().build(),
  );
}
