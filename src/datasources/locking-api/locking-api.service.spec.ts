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
} from '@/domain/community/entities/__tests__/locking-event.builder';
import { getAddress } from 'viem';
import { lockingRankBuilder } from '@/domain/community/entities/__tests__/locking-rank.builder';
import { campaignBuilder } from '@/domain/community/entities/__tests__/campaign.builder';
import { campaignRankBuilder } from '@/domain/community/entities/__tests__/campaign-rank.builder';
import { CampaignRank } from '@/domain/community/entities/campaign-rank.entity';
import { campaignPointsBuilder } from '@/domain/community/entities/__tests__/campaign-points.builder';

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
    it('should get a campaign by resourceId', async () => {
      const campaign = campaignBuilder().build();

      mockNetworkService.get.mockResolvedValueOnce({
        data: campaign,
        status: 200,
      });

      const result = await service.getCampaignById(campaign.resourceId);

      expect(result).toEqual(campaign);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}`,
      });
    });

    it('should forward error', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const campaign = campaignBuilder().build();
      const error = new NetworkResponseError(
        new URL(`${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(
        service.getCampaignById(campaign.resourceId),
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

  describe('getCampaignPointsForAddress', () => {
    it('should get campaigns for address', async () => {
      const campaign = campaignBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const campaignPointsPage = pageBuilder()
        .with('results', [
          campaignPointsBuilder().build(),
          campaignPointsBuilder().build(),
        ])
        .build();

      mockNetworkService.get.mockResolvedValueOnce({
        data: campaignPointsPage,
        status: 200,
      });

      const result = await service.getCampaignPointsForAddress({
        resourceId: campaign.resourceId,
        safeAddress,
      });

      expect(result).toEqual(campaignPointsPage);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/addresses/${safeAddress}/periods`,
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
      const campaign = campaignBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const campaignPointsPage = pageBuilder()
        .with('results', [
          campaignPointsBuilder().build(),
          campaignPointsBuilder().build(),
        ])
        .build();

      mockNetworkService.get.mockResolvedValueOnce({
        data: campaignPointsPage,
        status: 200,
      });

      await service.getCampaignPointsForAddress({
        resourceId: campaign.resourceId,
        safeAddress,
        limit,
        offset,
      });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/addresses/${safeAddress}/periods`,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    it('should forward error', async () => {
      const campaign = campaignBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(
          `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/addresses/${safeAddress}/periods`,
        ),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(
        service.getCampaignPointsForAddress({
          resourceId: campaign.resourceId,
          safeAddress,
        }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCampaignRank', () => {
    it('should get campaign rank', async () => {
      const resourceId = faker.string.uuid();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const campaignRank = campaignRankBuilder().build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: campaignRank,
        status: 200,
      });

      const result = await service.getCampaignRank({ resourceId, safeAddress });

      expect(result).toEqual(campaignRank);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${resourceId}/leaderboard/${safeAddress}`,
      });
    });

    it('should forward error', async () => {
      const resourceId = faker.string.uuid();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(
          `${lockingBaseUri}/api/v1/campaigns/${resourceId}/leaderboard/${safeAddress}`,
        ),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(
        service.getCampaignRank({ resourceId, safeAddress }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLockingRank', () => {
    it('should get locking rank', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const lockingRank = lockingRankBuilder().build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: lockingRank,
        status: 200,
      });

      const result = await service.getLockingRank(safeAddress);

      expect(result).toEqual(lockingRank);
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

      await expect(service.getLockingRank(safeAddress)).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLeaderboard', () => {
    it('should get leaderboard', async () => {
      const leaderboardPage = pageBuilder()
        .with('results', [lockingRankBuilder().build()])
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
        .with('results', [lockingRankBuilder().build()])
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

  describe('getCampaignLeaderboard', () => {
    it('should get leaderboard by campaign', async () => {
      const resourceId = faker.string.uuid();
      const campaignRankPage = pageBuilder<CampaignRank>()
        .with('results', [
          campaignRankBuilder().build(),
          campaignRankBuilder().build(),
        ])
        .build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: campaignRankPage,
        status: 200,
      });

      const result = await service.getCampaignLeaderboard({ resourceId });

      expect(result).toEqual(campaignRankPage);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${resourceId}/leaderboard`,
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
      const resourceId = faker.string.uuid();
      const campaignRankPage = pageBuilder<CampaignRank>()
        .with('results', [
          campaignRankBuilder().build(),
          campaignRankBuilder().build(),
        ])
        .build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: campaignRankPage,
        status: 200,
      });

      await service.getCampaignLeaderboard({ resourceId, limit, offset });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${resourceId}/leaderboard`,
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
      const resourceId = faker.string.uuid();
      const error = new NetworkResponseError(
        new URL(`${lockingBaseUri}/api/v1/campaigns/${resourceId}/leaderboard`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(
        service.getCampaignLeaderboard({ resourceId }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));

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
