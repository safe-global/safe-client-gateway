import { Builder, IBuilder } from '@/__tests__/builder';
import { Group } from '@/domain/accounts/entities/group.entity';
import { faker } from '@faker-js/faker';

export function groupBuilder(): IBuilder<Group> {
  return new Builder<Group>()
    .with('id', faker.number.int())
    .with('created_at', faker.date.recent())
    .with('updated_at', faker.date.recent());
}
