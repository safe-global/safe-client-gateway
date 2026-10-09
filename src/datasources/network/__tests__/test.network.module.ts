// SPDX-License-Identifier: FSL-1.1-MIT

import { jest } from 'bun:test';
import { Global, Module } from '@nestjs/common';
import { type MockedObject, mocked } from '#/__tests__/mocks';
import {
  type INetworkService,
  NetworkService,
} from '#/datasources/network/network.service.interface';

export const networkService: INetworkService = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  postForm: jest.fn(),
  delete: jest.fn(),
};

/**
 * The {@link TestNetworkModule} should be used whenever a mocked HTTP client
 * should be used.
 *
 * Example:
 * Test.createTestingModule({ imports: [ModuleA, TestNetworkModule]}).compile();
 *
 * This will create a TestModule which uses the implementation of ModuleA but
 * overrides the real HTTP client with a mocked one
 */
@Global()
@Module({
  providers: [
    {
      provide: NetworkService,
      useFactory: (): MockedObject<INetworkService> => {
        return mocked(networkService);
      },
    },
  ],
  exports: [NetworkService],
})
export class TestNetworkModule {}
