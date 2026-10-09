// SPDX-License-Identifier: FSL-1.1-MIT

import { jest } from 'bun:test';
import type { ObjectLiteral, Repository } from 'typeorm';
import type { MockedObject } from '#/__tests__/mocks';
import { mockEntityManager } from '#/datasources/db/v2/__tests__/entity-manager.mock';

export const mockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  upsert: jest.fn(),
  remove: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  insert: jest.fn(),
  count: jest.fn(),
  findBy: jest.fn(),
  findOneBy: jest.fn(),
  manager: mockEntityManager,
} as unknown as MockedObject<Repository<ObjectLiteral>>;
