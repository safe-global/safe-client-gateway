// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import type { ISpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository.interface';

export function createMockSpaceAuditRepository(): MockedObject<ISpaceAuditRepository> {
  return {
    record: vi.fn(),
    findBySpaceId: vi.fn(),
    findDistinctActorIds: vi.fn(),
  } as MockedObject<ISpaceAuditRepository>;
}
