// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress } from 'viem';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import type { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { rawify } from '@/validation/entities/raw.entity';

describe('PositionsController (Integration)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let zerionBaseUri: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  describe('CaptchaGuard', () => {
    const turnstileUrl =
      'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const captchaSecretKey = faker.string.alphanumeric(32);

    beforeEach(async () => {
      jest.resetAllMocks();

      const baseConfig = configuration();
      const customConfig = (): ReturnType<typeof configuration> => ({
        ...baseConfig,
        features: {
          ...baseConfig.features,
          zerionPositions: true,
        },
        captcha: { enabled: true, secretKey: captchaSecretKey },
      });
      const moduleFixture = await createTestModule({ config: customConfig });
      const configurationService = moduleFixture.get<IConfigurationService>(
        IConfigurationService,
      );
      safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
      zerionBaseUri = configurationService.getOrThrow(
        'balances.providers.zerion.baseUri',
      );
      networkService = moduleFixture.get(NetworkService);

      app = await new TestAppProvider().provide(moduleFixture);
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('returns 401 when the captcha token header is missing', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const fiatCode = 'USD';

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/safes/${safeAddress}/positions/${fiatCode}`)
        .expect(401);

      // Downstream services must not be reached when the guard rejects.
      expect(networkService.get).not.toHaveBeenCalled();
    });

    it('returns 401 when the captcha token is invalid', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const fiatCode = 'USD';
      const token = faker.string.alphanumeric();

      networkService.post.mockImplementation(({ url }) => {
        if (url === turnstileUrl) {
          return Promise.resolve({
            data: rawify({ success: false }),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/safes/${safeAddress}/positions/${fiatCode}`)
        .set('x-captcha-token', token)
        .expect(401);

      expect(networkService.get).not.toHaveBeenCalled();
    });

    it('lets the request through when the captcha token is valid', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const fiatCode = 'USD';
      const token = faker.string.alphanumeric();
      const chain = chainBuilder().with('chainId', chainId).build();

      networkService.post.mockImplementation(({ url }) => {
        if (url === turnstileUrl) {
          return Promise.resolve({
            data: rawify({ success: true }),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      networkService.get.mockImplementation(
        ({ url }: { url: string; networkRequest?: NetworkRequest }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (
            url ===
            `${zerionBaseUri}/v1/wallets/${getAddress(safeAddress)}/positions`
          ) {
            return Promise.resolve({
              data: rawify({ data: [] }),
              status: 200,
            });
          }
          return Promise.reject(`No matching rule for url: ${url}`);
        },
      );

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/safes/${safeAddress}/positions/${fiatCode}`)
        .set('x-captcha-token', token)
        .expect(200)
        .expect([]);

      // Captcha verification was performed, and downstream call was reached.
      expect(networkService.post).toHaveBeenCalledWith(
        expect.objectContaining({ url: turnstileUrl }),
      );
    });
  });
});
