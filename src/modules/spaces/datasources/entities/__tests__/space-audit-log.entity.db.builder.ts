// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import type { SpaceAuditLog } from '@/modules/spaces/datasources/entities/space-audit-log.entity.db';
import { fakeUuid } from '@/validation/entities/schemas/__tests__/uuid.builder';

export function spaceAuditLogBuilder(): IBuilder<SpaceAuditLog> {
  return new Builder<SpaceAuditLog>()
    .with('id', faker.number.int({ max: DB_MAX_SAFE_INTEGER }).toString())
    .with('spaceId', faker.number.int({ max: DB_MAX_SAFE_INTEGER }))
    .with('spaceUuid', fakeUuid())
    .with('eventType', 'MEMBER_INVITE_ACCEPTED')
    .with('actorUserId', faker.number.int({ max: DB_MAX_SAFE_INTEGER }))
    .with('payload', {
      targetUserId: faker.number.int({ max: DB_MAX_SAFE_INTEGER }),
    })
    .with('createdAt', new Date());
}
