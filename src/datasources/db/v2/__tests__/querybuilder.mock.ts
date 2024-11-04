import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export const mockQueryBuilder = {
  delete: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  execute: jest.fn(),
} as jest.MockedObjectDeep<SelectQueryBuilder<ObjectLiteral>>;
