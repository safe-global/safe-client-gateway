import { faker } from '@faker-js/faker';
import { Backbone } from '../backbone.entity';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function backboneBuilder(): IBuilder<Backbone> {
  return Builder.new<Backbone>()
    .with('name', faker.random.word())
    .with('version', faker.system.semver())
    .with('api_version', faker.system.semver())
    .with('secure', faker.datatype.boolean())
    .with('host', faker.internet.url())
    .with(
      'headers',
      Array.from({ length: faker.datatype.number({ min: 0, max: 5 }) }, () =>
        faker.random.word(),
      ),
    )
    .with('settings', JSON.parse(faker.datatype.json()));
}
