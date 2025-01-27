import type { ObjectLiteral, Repository } from 'typeorm';

export const mockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  upsert: jest.fn(),
  remove: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  insert: jest.fn(),
} as jest.MockedObjectDeep<Repository<ObjectLiteral>>;
