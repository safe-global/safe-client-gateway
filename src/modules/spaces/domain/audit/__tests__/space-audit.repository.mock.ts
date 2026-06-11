// SPDX-License-Identifier: FSL-1.1-MIT
import type { ISpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository.interface';

export function createMockSpaceAuditRepository(): jest.MockedObjectDeep<ISpaceAuditRepository> {
  return {
    record: jest.fn(),
    findBySpaceId: jest.fn(),
    findDistinctActorIds: jest.fn(),
  } as jest.MockedObjectDeep<ISpaceAuditRepository>;
}
