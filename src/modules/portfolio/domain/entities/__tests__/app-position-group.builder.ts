import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { AppPositionGroup } from '@/modules/portfolio/domain/entities/app-position.entity';
import { appPositionBuilder } from '@/modules/portfolio/domain/entities/__tests__/app-position.builder';

export function appPositionGroupBuilder(): IBuilder<AppPositionGroup> {
  return new Builder<AppPositionGroup>()
    .with('name', faker.company.buzzPhrase())
    .with('items', [
      appPositionBuilder().build(),
      appPositionBuilder().build(),
    ]);
}
