import { mockQueryBuilder } from '@/datasources/db/v2/__tests__/querybuilder.mock';
import type { EntityManager } from 'typeorm';

export const mockEntityManager = {
  find: jest.fn(),
  query: jest.fn(),
  upsert: jest.fn(),
  createQueryBuilder: jest.fn().mockImplementation(() => mockQueryBuilder),
  getRepository: jest.fn(),
} as jest.MockedObjectDeep<EntityManager>;
