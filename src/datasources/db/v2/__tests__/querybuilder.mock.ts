import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { MockedObject } from 'vitest';

export const mockQueryBuilder = {
  delete: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  execute: vi.fn(),
} as MockedObject<SelectQueryBuilder<ObjectLiteral>>;
