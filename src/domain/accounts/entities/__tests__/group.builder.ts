import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Group } from '@/domain/accounts/entities/group.entity';
import { faker } from '@faker-js/faker';

export function groupBuilder(): IBuilder<Group> {
  return new Builder<Group>()
    .with('id', faker.number.int())
    .with('created_at', faker.date.recent())
    .with('updated_at', faker.date.recent());
}
