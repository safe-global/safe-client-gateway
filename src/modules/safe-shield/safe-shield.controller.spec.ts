import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'net';
import request from 'supertest';
import { getAddress } from 'viem';
import { rawify } from '@/validation/entities/raw.entity';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  DESCRIPTION_MAPPING,
  SEVERITY_MAPPING,
  TITLE_MAPPING,
} from '@/modules/safe-shield/recipient-analysis/recipient-analysis.constants';

describe('SafeShieldController (Unit)', () => {
  let app: INestApplication<Server>;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  const mockChainId = faker.number.int({ min: 1, max: 999999 }).toString();
  const mockSafeAddress = getAddress(faker.finance.ethereumAddress());
  const mockRecipientAddress = getAddress(faker.finance.ethereumAddress());

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture = await createTestModule({});

    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /chains/:chainId/security/:safeAddress/recipient/:recipientAddress', () => {
    it('should return recipient analysis results for a new recipient', async () => {
      const chain = chainBuilder().with('chainId', mockChainId).build();
      const transfersPage = pageBuilder()
        .with('count', 0)
        .with('results', [])
        .build();

      networkService.get.mockResolvedValueOnce({
        data: rawify(chain),
        status: 200,
      });
      networkService.get.mockResolvedValueOnce({
        data: rawify(transfersPage),
        status: 200,
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${mockChainId}/security/${mockSafeAddress}/recipient/${mockRecipientAddress}`,
        )
        .expect(200)
        .then((response) => {
          expect(response.body).toEqual({
            RECIPIENT_INTERACTION: [
              {
                type: 'NEW_RECIPIENT',
                severity: SEVERITY_MAPPING.NEW_RECIPIENT,
                title: TITLE_MAPPING.NEW_RECIPIENT,
                description: DESCRIPTION_MAPPING.NEW_RECIPIENT(0),
              },
            ],
          });
        });

      expect(networkService.get).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          url: expect.stringContaining(`/api/v1/chains/${mockChainId}`),
        }),
      );
      expect(networkService.get).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          url: expect.stringContaining(
            `/api/v1/safes/${mockSafeAddress}/transfers/`,
          ),
          networkRequest: expect.objectContaining({
            params: expect.objectContaining({
              to: mockRecipientAddress,
              limit: 1,
            }),
          }),
        }),
      );
    });

    it('should validate safeAddress parameter', async () => {
      const invalidAddress = 'invalid-address';

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${mockChainId}/security/${invalidAddress}/recipient/${mockRecipientAddress}`,
        )
        .expect(422);

      expect(networkService.get).not.toHaveBeenCalled();
    });

    it('should validate recipientAddress parameter', async () => {
      const invalidAddress = 'invalid-address';

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${mockChainId}/security/${mockSafeAddress}/recipient/${invalidAddress}`,
        )
        .expect(422);

      expect(networkService.get).not.toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      const chain = chainBuilder().with('chainId', mockChainId).build();

      networkService.get.mockResolvedValueOnce({
        data: rawify(chain),
        status: 200,
      });
      networkService.get.mockRejectedValueOnce(new Error('Network error'));

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${mockChainId}/security/${mockSafeAddress}/recipient/${mockRecipientAddress}`,
        )
        .expect(503);
    });
  });
});
