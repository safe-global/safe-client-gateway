// SPDX-License-Identifier: FSL-1.1-MIT

import { jest } from 'bun:test';
import type { EntityManager } from 'typeorm';
import type { MockedObject } from '#/__tests__/mocks';
import { mockPostgresDataSource } from '#/datasources/db/v2/__tests__/postgresql-datasource.mock';
import { mockQueryBuilder } from '#/datasources/db/v2/__tests__/querybuilder.mock';

export const mockEntityManager = {
  find: jest.fn(),
  findOneOrFail: jest.fn(),
  query: jest.fn(),
  upsert: jest.fn(),
  createQueryBuilder: jest.fn().mockImplementation(() => mockQueryBuilder),
  getRepository: jest.fn(),
  connection: mockPostgresDataSource,
} as unknown as MockedObject<EntityManager>;
