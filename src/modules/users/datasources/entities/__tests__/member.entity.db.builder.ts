import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Member } from '@/modules/users/datasources/entities/member.entity.db';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import type { User } from '@/modules/users/datasources/entities/users.entity.db';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

export function memberBuilder(): IBuilder<Member> {
  return new Builder<Member>()
    .with('id', faker.number.int())
    .with('user', { id: faker.number.int() } as User)
    .with('space', { id: faker.number.int() } as Space)
    .with('name', nameBuilder())
    .with('alias', null)
    .with('role', 'ADMIN')
    .with('status', 'ACTIVE')
    .with('invitedBy', getAddress(faker.finance.ethereumAddress()))
    .with('createdAt', new Date())
    .with('updatedAt', new Date());
}
