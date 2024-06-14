import { IBuilder, Builder } from '@/__tests__/builder';
import { Group } from '@/datasources/accounts/entities/group.entity';
import { faker } from '@faker-js/faker';

export function groupBuilder(): IBuilder<Group> {
  return new Builder<Group>().with('id', faker.number.int());
}
