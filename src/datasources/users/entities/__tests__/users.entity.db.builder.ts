import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker/.';
import type { User } from '@/datasources/users/entities/users.entity.db';
import { UserStatus } from '@/domain/users/entities/user.entity';

export function userBuilder(): IBuilder<User> {
  return new Builder<User>()
    .with('id', faker.number.int())
    .with('status', faker.helpers.enumValue(UserStatus))
    .with('created_at', new Date())
    .with('updated_at', new Date());
}
