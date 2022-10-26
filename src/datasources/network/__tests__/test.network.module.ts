import { Global, Module } from '@nestjs/common';
import { NetworkService, INetworkService } from '../network.service.interface';

const networkService: INetworkService = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
};

/**
 * Mocked Network interface which can be used in a testing scenario
 * to mock any external HTTP call made as long as it is done with
 * the {@link NetworkService}
 * @type {jest.Mocked}
 */
export const mockNetworkService = jest.mocked(networkService);

/**
 * The {@link TestNetworkModule} should be used whenever a mocked HTTP client
 * should be used.
 *
 * Example:
 * Test.createTestingModule({ imports: [ModuleA, TestNetworkModule]}).compile();
 *
 * This will create a TestModule which uses the implementation of ModuleA but
 * overrides the real HTTP client with a mocked one – {@link mockNetworkService}
 */
@Global()
@Module({
  providers: [{ provide: NetworkService, useValue: mockNetworkService }],
  exports: [NetworkService],
})
export class TestNetworkModule {}
