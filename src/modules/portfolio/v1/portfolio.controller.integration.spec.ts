// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { rawify } from '@/validation/entities/raw.entity';

describe('PortfolioController (Integration)', () => {
  let app: INestApplication<Server>;
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
        captcha: { enabled: true, secretKey: captchaSecretKey },
      });
      const moduleFixture = await createTestModule({ config: customConfig });
      const configurationService = moduleFixture.get<IConfigurationService>(
        IConfigurationService,
      );
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
      const address = faker.finance.ethereumAddress();

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .expect(401);

      // Downstream services must not be reached when the guard rejects.
      expect(networkService.get).not.toHaveBeenCalled();
    });

    it('returns 401 when the captcha token is invalid', async () => {
      const address = faker.finance.ethereumAddress();
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
        .get(`/v1/portfolio/${address}`)
        .set('x-captcha-token', token)
        .expect(401);

      expect(networkService.get).not.toHaveBeenCalled();
    });

    it('lets the request through when the captcha token is valid', async () => {
      const address = faker.finance.ethereumAddress();
      const token = faker.string.alphanumeric();

      networkService.post.mockImplementation(({ url }) => {
        if (url === turnstileUrl) {
          return Promise.resolve({
            data: rawify({ success: true }),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      networkService.get.mockImplementation(({ url }: { url: string }) => {
        if (url.startsWith(`${zerionBaseUri}/v1/wallets/`)) {
          return Promise.resolve({
            data: rawify({ data: [] }),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .set('x-captcha-token', token)
        .expect(200);

      // Captcha verification was performed, and downstream call was reached.
      expect(networkService.post).toHaveBeenCalledWith(
        expect.objectContaining({ url: turnstileUrl }),
      );
    });
  });
});
