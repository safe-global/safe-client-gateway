// SPDX-License-Identifier: FSL-1.1-MIT
import { jest } from 'bun:test';
import type { MockedObject } from '#/__tests__/mocks';
import type { ISpaceAuditRepository } from '#/modules/spaces/domain/audit/space-audit.repository.interface';

export function createMockSpaceAuditRepository(): MockedObject<ISpaceAuditRepository> {
  return {
    record: jest.fn(),
    findBySpaceId: jest.fn(),
    findDistinctActorIds: jest.fn(),
  } as MockedObject<ISpaceAuditRepository>;
}
