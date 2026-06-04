// SPDX-License-Identifier: FSL-1.1-MIT

import type { EntityManager } from 'typeorm';
import type { MockedObject } from 'vitest';
import { mockPostgresDataSource } from '@/datasources/db/v2/__tests__/postgresql-datasource.mock';
import { mockQueryBuilder } from '@/datasources/db/v2/__tests__/querybuilder.mock';

export const mockEntityManager = {
  find: vi.fn(),
  findOneOrFail: vi.fn(),
  query: vi.fn(),
  upsert: vi.fn(),
  createQueryBuilder: vi.fn().mockImplementation(() => mockQueryBuilder),
  getRepository: vi.fn(),
  connection: mockPostgresDataSource,
} as unknown as MockedObject<EntityManager>;
