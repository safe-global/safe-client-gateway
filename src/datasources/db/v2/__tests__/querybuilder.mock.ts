// SPDX-License-Identifier: FSL-1.1-MIT
import { jest } from 'bun:test';
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { MockedObject } from '#/__tests__/mocks';

export const mockQueryBuilder = {
  delete: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  execute: jest.fn(),
} as MockedObject<SelectQueryBuilder<ObjectLiteral>>;
