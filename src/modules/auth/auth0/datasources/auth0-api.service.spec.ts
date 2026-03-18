// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { Auth0Api } from '@/modules/auth/auth0/datasources/auth0-api.service';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';

const networkService = {
  postForm: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>;

describe('Auth0Api', () => {
  let target: Auth0Api;

  beforeEach(() => {
    jest.resetAllMocks();
    target = new Auth0Api(networkService, new HttpErrorFactory());
  });

  describe('exchangeAuthorizationCode', () => {
    it('should exchange an authorization code for tokens', async () => {
      const baseUri = faker.internet.url({ appendSlash: false });
      const clientId = faker.string.uuid();
      const clientSecret = faker.string.uuid();
      const code = faker.string.alphanumeric(32);
      const redirectUri = faker.internet.url();
      const tokenResponse = {
        access_token: faker.string.alphanumeric(),
        refresh_token: faker.string.alphanumeric(),
        id_token: faker.string.alphanumeric(),
        token_type: 'Bearer',
        expires_in: faker.number.int({ min: 60, max: 3_600 }),
      };
      networkService.postForm.mockResolvedValueOnce({
        status: 200,
        data: rawify(tokenResponse),
      });

      await expect(
        target.exchangeAuthorizationCode({
          baseUri,
          clientId,
          clientSecret,
          code,
          redirectUri,
        }),
      ).resolves.toBe(tokenResponse);

      expect(networkService.postForm).toHaveBeenCalledWith({
        url: new URL('/oauth/token', baseUri).toString(),
        data: {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        },
      });
    });

    it('should map network errors', async () => {
      const baseUri = faker.internet.url({ appendSlash: false });
      networkService.postForm.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL('/oauth/token', baseUri),
          {
            status: 401,
          } as Response,
          { message: 'Unauthorized' },
        ),
      );

      await expect(
        target.exchangeAuthorizationCode({
          baseUri,
          clientId: faker.string.uuid(),
          clientSecret: faker.string.uuid(),
          code: faker.string.alphanumeric(32),
          redirectUri: faker.internet.url(),
        }),
      ).rejects.toThrow('Unauthorized');
    });
  });
});
