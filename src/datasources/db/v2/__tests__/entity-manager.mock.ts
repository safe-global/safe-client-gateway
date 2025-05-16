import { mockPostgresDataSource } from '@/datasources/db/v2/__tests__/postgresql-datasource.mock';
import { mockQueryBuilder } from '@/datasources/db/v2/__tests__/querybuilder.mock';
import type { EntityManager } from 'typeorm';

export const mockEntityManager = {
  find: jest.fn(),
  findOneOrFail: jest.fn(),
  query: jest.fn(),
  upsert: jest.fn(),
  createQueryBuilder: jest.fn().mockImplementation(() => mockQueryBuilder),
  getRepository: jest.fn(),
  connection: mockPostgresDataSource,
} as jest.MockedObjectDeep<EntityManager>;
