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
import { getAddress } from 'viem';
import { rankBuilder } from '@/domain/locking/entities/__tests__/rank.builder';
import { campaignBuilder } from '@/domain/locking/entities/__tests__/campaign.builder';
import { holderBuilder } from '@/domain/locking/entities/__tests__/holder.builder';

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

  describe('getCampaignById', () => {
    it('should get a campaign by campaignId', async () => {
      const campaign = campaignBuilder().build();

      mockNetworkService.get.mockResolvedValueOnce({
        data: campaign,
        status: 200,
      });

      const result = await service.getCampaignById(campaign.campaignId);

      expect(result).toEqual(campaign);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${campaign.campaignId}`,
      });
    });

    it('should forward error', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const campaign = campaignBuilder().build();
      const error = new NetworkResponseError(
        new URL(`${lockingBaseUri}/api/v1/campaigns/${campaign.campaignId}`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(
        service.getCampaignById(campaign.campaignId),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCampaigns', () => {
    it('should get campaigns', async () => {
      const campaignsPage = pageBuilder()
        .with('results', [campaignBuilder().build(), campaignBuilder().build()])
        .build();

      mockNetworkService.get.mockResolvedValueOnce({
        data: campaignsPage,
        status: 200,
      });

      const result = await service.getCampaigns({});

      expect(result).toEqual(campaignsPage);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns`,
        networkRequest: {
          params: {
            limit: undefined,
            offset: undefined,
          },
        },
      });
    });

    it('should forward pagination queries', async () => {
      const limit = faker.number.int();
      const offset = faker.number.int();
      const campaignsPage = pageBuilder()
        .with('results', [campaignBuilder().build(), campaignBuilder().build()])
        .build();

      mockNetworkService.get.mockResolvedValueOnce({
        data: campaignsPage,
        status: 200,
      });

      await service.getCampaigns({ limit, offset });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns`,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    it('should forward error', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${lockingBaseUri}/api/v1/campaigns`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(service.getCampaigns({})).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRank', () => {
    it('should get rank', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const rank = rankBuilder().build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: {
          rank,
        },
        status: 200,
      });

      const result = await service.getRank(safeAddress);

      expect(result).toEqual({ rank });
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/leaderboard/${safeAddress}`,
      });
    });

    it('should forward error', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${lockingBaseUri}/api/v1/leaderboard/${safeAddress}`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(service.getRank(safeAddress)).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLeaderboard', () => {
    it('should get leaderboard', async () => {
      const leaderboardPage = pageBuilder()
        .with('results', [rankBuilder().build()])
        .build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: leaderboardPage,
        status: 200,
      });

      const result = await service.getLeaderboard({});

      expect(result).toEqual(leaderboardPage);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/leaderboard`,
        networkRequest: {
          params: {
            limit: undefined,
            offset: undefined,
          },
        },
      });
    });

    it('should forward pagination queries', async () => {
      const limit = faker.number.int();
      const offset = faker.number.int();
      const leaderboardPage = pageBuilder()
        .with('results', [rankBuilder().build()])
        .build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: leaderboardPage,
        status: 200,
      });

      await service.getLeaderboard({ limit, offset });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/leaderboard`,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    it('should forward error', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${lockingBaseUri}/api/v1/leaderboard`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(service.getLeaderboard({})).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLeaderboardV2', () => {
    it('should get leaderboard v2', async () => {
      const campaignId = faker.string.uuid();
      const leaderboardV2Page = pageBuilder()
        .with('results', [holderBuilder().build(), holderBuilder().build()])
        .build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: leaderboardV2Page,
        status: 200,
      });

      const result = await service.getLeaderboardV2({ campaignId });

      expect(result).toEqual(leaderboardV2Page);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v2/leaderboard/${campaignId}`,
        networkRequest: {
          params: {
            limit: undefined,
            offset: undefined,
          },
        },
      });
    });

    it('should forward pagination queries', async () => {
      const limit = faker.number.int();
      const offset = faker.number.int();
      const campaignId = faker.string.uuid();
      const leaderboardV2Page = pageBuilder()
        .with('results', [holderBuilder().build(), holderBuilder().build()])
        .build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: leaderboardV2Page,
        status: 200,
      });

      await service.getLeaderboardV2({ campaignId, limit, offset });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v2/leaderboard/${campaignId}`,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    it('should forward error', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const campaignId = faker.string.uuid();
      const error = new NetworkResponseError(
        new URL(`${lockingBaseUri}/api/v2/leaderboard/${campaignId}`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(service.getLeaderboardV2({ campaignId })).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLockingHistory', () => {
    it('should get locking history', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
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

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/all-events/${safeAddress}`,
        networkRequest: {
          params: {
            limit: undefined,
            offset: undefined,
          },
        },
      });
    });

    it('should forward pagination queries', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
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

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/all-events/${safeAddress}`,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    it('should forward error', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
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
