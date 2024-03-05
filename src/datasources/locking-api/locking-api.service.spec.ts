import { faker } from '@faker-js/faker';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { LockingApi } from '@/datasources/locking-api/locking-api.service';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  lockEventItemBuilder,
  unlockEventItemBuilder,
  withdrawEventItemBuilder,
} from '@/domain/locking/entities/__tests__/locking-event.builder';

const networkService = {
  get: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>;
const mockNetworkService = jest.mocked(networkService);

describe('LockingApi', () => {
  let service: LockingApi;
  let fakeConfigurationService: FakeConfigurationService;
  let httpErrorFactory: HttpErrorFactory;

  let lockingBaseUri: string;

  beforeEach(() => {
    jest.resetAllMocks();

    lockingBaseUri = faker.internet.url({ appendSlash: false });

    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('locking.baseUri', lockingBaseUri);

    httpErrorFactory = new HttpErrorFactory();

    service = new LockingApi(
      fakeConfigurationService,
      mockNetworkService,
      httpErrorFactory,
    );
  });

  it.todo('getLeaderboard');

  describe('getLockingHistory', () => {
    it('should get locking history', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      const lockingHistoryPage = pageBuilder()
        .with('results', [
          lockEventItemBuilder().build(),
          unlockEventItemBuilder().build(),
          withdrawEventItemBuilder().build(),
        ])
        .build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: lockingHistoryPage,
        status: 200,
      });

      await service.getLockingHistory({ safeAddress });

      expect(mockNetworkService.get).toHaveBeenCalledWith(
        `${lockingBaseUri}/api/v1/all-events/${safeAddress}`,
        {
          params: {
            limit: undefined,
            offset: undefined,
          },
        },
      );
    });

    it('should forward pagination queries', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      const limit = faker.number.int();
      const offset = faker.number.int();
      const lockingHistoryPage = pageBuilder()
        .with('results', [
          lockEventItemBuilder().build(),
          unlockEventItemBuilder().build(),
          withdrawEventItemBuilder().build(),
        ])
        .build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: lockingHistoryPage,
        status: 200,
      });

      await service.getLockingHistory({ safeAddress, limit, offset });

      expect(mockNetworkService.get).toHaveBeenCalledWith(
        `${lockingBaseUri}/api/v1/all-events/${safeAddress}`,
        {
          params: {
            limit,
            offset,
          },
        },
      );
    });

    it('should forward error', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${lockingBaseUri}/api/v1/all-events/${safeAddress}`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(service.getLockingHistory({ safeAddress })).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });
});
