import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker/.';
import type { User } from '@/modules/users/datasources/entities/users.entity.db';
import { UserStatus } from '@/modules/users/domain/entities/user.entity';

export function userBuilder(): IBuilder<User> {
  return new Builder<User>()
    .with('id', faker.number.int())
    .with('status', faker.helpers.enumValue(UserStatus))
    .with('created_at', new Date())
    .with('updated_at', new Date());
}
