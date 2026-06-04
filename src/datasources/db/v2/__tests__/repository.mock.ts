// SPDX-License-Identifier: FSL-1.1-MIT

import type { ObjectLiteral, Repository } from 'typeorm';
import type { MockedObject } from 'vitest';
import { mockEntityManager } from '@/datasources/db/v2/__tests__/entity-manager.mock';

export const mockRepository = {
  find: vi.fn(),
  findOne: vi.fn(),
  upsert: vi.fn(),
  remove: vi.fn(),
  delete: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  insert: vi.fn(),
  count: vi.fn(),
  findBy: vi.fn(),
  findOneBy: vi.fn(),
  manager: mockEntityManager,
} as MockedObject<Repository<ObjectLiteral>>;
