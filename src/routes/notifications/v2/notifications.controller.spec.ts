import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestAccountsDataSourceModule } from '@/datasources/accounts/__tests__/test.accounts.datasource.module';
import { AccountsDatasourceModule } from '@/datasources/accounts/accounts.datasource.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { delegateBuilder } from '@/domain/delegate/entities/__tests__/delegate.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { upsertSubscriptionsDtoBuilder } from '@/routes/notifications/v2/entities/__tests__/upsert-subscriptions.dto.builder';
import { deleteAllSubscriptionsDtoBuilder } from '@/domain/notifications/v2/entities/__tests__/delete-all-subscriptions.dto.builder';
import type { Chain } from '@/routes/chains/entities/chain.entity';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Server } from 'net';
import request from 'supertest';
import { getAddress } from 'viem';
import { CounterfactualSafesDatasourceModule } from '@/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource.module';
import { TestCounterfactualSafesDataSourceModule } from '@/datasources/accounts/counterfactual-safes/__tests__/test.counterfactual-safes.datasource.module';
import { INotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository.interface';
import { NotificationType } from '@/datasources/notifications/entities/notification-type.entity.db';
import { TestAddressBooksDataSourceModule } from '@/datasources/accounts/address-books/__tests__/test.address-books.datasource.module';
import { AddressBooksDatasourceModule } from '@/datasources/accounts/address-books/address-books.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';
import { NotificationsRepositoryV2Module } from '@/domain/notifications/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/domain/notifications/v2/test.notification.repository.module';
import type { DeleteAllSubscriptionsDto } from '@/domain/notifications/v2/entities/delete-all-subscriptions.dto.entity';
import { createTestModule } from '@/__tests__/testing-module';

describe('Notifications Controller V2 (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let jwtService: IJwtService;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let notificationsRepository: jest.MockedObjectDeep<INotificationsRepositoryV2>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        auth: true,
        accounts: true,
      },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
      modules: [
        {
          originalModule: NotificationsRepositoryV2Module,
          testModule: TestNotificationsRepositoryV2Module,
        },
        {
          originalModule: AccountsDatasourceModule,
          testModule: TestAccountsDataSourceModule,
        },
        {
          originalModule: AddressBooksDatasourceModule,
          testModule: TestAddressBooksDataSourceModule,
        },
        {
          originalModule: CounterfactualSafesDatasourceModule,
          testModule: TestCounterfactualSafesDataSourceModule,
        },
        {
          originalModule: NotificationsRepositoryV2Module,
          testModule: TestNotificationsRepositoryV2Module,
        },
      ],
    });

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    networkService = moduleFixture.get(NetworkService);
    notificationsRepository = moduleFixture.get(INotificationsRepositoryV2);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /v2/register/notifications', () => {
    it('should upsert subscription(s) for owners', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
      const chains = upsertSubscriptionsDto.safes.reduce<Record<string, Chain>>(
        (acc, { chainId }) => {
          if (!acc[chainId]) {
            acc[chainId] = chainBuilder().with('chainId', chainId).build();
          }
          return acc;
        },
        {},
      );
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .with(
          'chain_id',
          faker.helpers.arrayElement(upsertSubscriptionsDto.safes).chainId,
        )
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      networkService.get.mockImplementation(({ url }) => {
        for (const safe of upsertSubscriptionsDto.safes) {
          const chain = chains[safe.chainId];

          if (url === `${safeConfigUrl}/api/v1/chains/${safe.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (
            url === `${chain.transactionService}/api/v1/safes/${safe.address}`
          ) {
            return Promise.resolve({
              data: rawify(
                safeBuilder()
                  .with('address', safe.address)
                  .with('owners', [signerAddress])
                  .build(),
              ),
              status: 200,
            });
          }
          if (url === `${chain.transactionService}/api/v2/delegates/`) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', []).build()),
              status: 200,
            });
          }
        }

        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(`/v2/register/notifications`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(upsertSubscriptionsDto)
        .expect(201);

      expect(notificationsRepository.upsertSubscriptions).toHaveBeenCalledTimes(
        1,
      );
      expect(
        notificationsRepository.upsertSubscriptions,
      ).toHaveBeenNthCalledWith(1, {
        authPayload: {
          signer_address: signerAddress,
          chain_id: authPayloadDto.chain_id,
        },
        upsertSubscriptionsDto,
      });
    });

    it('should upsert subscription(s) for delegates', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
      const chains = upsertSubscriptionsDto.safes.reduce<Record<string, Chain>>(
        (acc, { chainId }) => {
          if (!acc[chainId]) {
            acc[chainId] = chainBuilder().with('chainId', chainId).build();
          }
          return acc;
        },
        {},
      );
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .with(
          'chain_id',
          faker.helpers.arrayElement(upsertSubscriptionsDto.safes).chainId,
        )
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      networkService.get.mockImplementation(({ url }) => {
        for (const safe of upsertSubscriptionsDto.safes) {
          const chain = chains[safe.chainId];

          if (url === `${safeConfigUrl}/api/v1/chains/${safe.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (
            url === `${chain.transactionService}/api/v1/safes/${safe.address}`
          ) {
            return Promise.resolve({
              data: rawify(safeBuilder().with('address', safe.address).build()),
              status: 200,
            });
          }
          if (url === `${chain.transactionService}/api/v2/delegates/`) {
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('results', [
                    delegateBuilder()
                      .with('delegate', signerAddress)
                      .with('safe', safe.address)
                      .build(),
                  ])
                  .build(),
              ),
              status: 200,
            });
          }
        }

        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(`/v2/register/notifications`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(upsertSubscriptionsDto)
        .expect(201);

      expect(notificationsRepository.upsertSubscriptions).toHaveBeenCalledTimes(
        1,
      );
      expect(
        notificationsRepository.upsertSubscriptions,
      ).toHaveBeenNthCalledWith(1, {
        authPayload: {
          signer_address: signerAddress,
          chain_id: authPayloadDto.chain_id,
        },
        upsertSubscriptionsDto,
      });
    });

    it('should allow subscription upsertion with a token with the same signer_address from a different chain_id', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
      const chains = upsertSubscriptionsDto.safes.reduce<Record<string, Chain>>(
        (acc, { chainId }) => {
          if (!acc[chainId]) {
            acc[chainId] = chainBuilder().with('chainId', chainId).build();
          }
          return acc;
        },
        {},
      );
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .with(
          'chain_id',
          faker.string.numeric({
            exclude: upsertSubscriptionsDto.safes.map((safe) => safe.chainId),
          }),
        )
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      networkService.get.mockImplementation(({ url }) => {
        for (const safe of upsertSubscriptionsDto.safes) {
          const chain = chains[safe.chainId];

          if (url === `${safeConfigUrl}/api/v1/chains/${safe.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (
            url === `${chain.transactionService}/api/v1/safes/${safe.address}`
          ) {
            return Promise.resolve({
              data: rawify(
                safeBuilder()
                  .with('address', safe.address)
                  .with('owners', [signerAddress])
                  .build(),
              ),
              status: 200,
            });
          }
          if (url === `${chain.transactionService}/api/v2/delegates/`) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', []).build()),
              status: 200,
            });
          }
        }

        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(`/v2/register/notifications`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(upsertSubscriptionsDto)
        .expect(201);

      expect(notificationsRepository.upsertSubscriptions).toHaveBeenCalledTimes(
        1,
      );
      expect(
        notificationsRepository.upsertSubscriptions,
      ).toHaveBeenNthCalledWith(1, {
        authPayload: {
          signer_address: signerAddress,
          chain_id: authPayloadDto.chain_id,
        },
        upsertSubscriptionsDto,
      });
    });

    it('should allow subscription(s) to the same Safe with different devices', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
      const secondSubscriptionDto = upsertSubscriptionsDtoBuilder()
        .with('safes', upsertSubscriptionsDto.safes)
        .with('deviceUuid', null)
        .build();
      const chains = upsertSubscriptionsDto.safes.reduce<Record<string, Chain>>(
        (acc, { chainId }) => {
          if (!acc[chainId]) {
            acc[chainId] = chainBuilder().with('chainId', chainId).build();
          }
          return acc;
        },
        {},
      );
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .with(
          'chain_id',
          faker.helpers.arrayElement(upsertSubscriptionsDto.safes).chainId,
        )
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      networkService.get.mockImplementation(({ url }) => {
        for (const safe of upsertSubscriptionsDto.safes) {
          const chain = chains[safe.chainId];

          if (url === `${safeConfigUrl}/api/v1/chains/${safe.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (
            url === `${chain.transactionService}/api/v1/safes/${safe.address}`
          ) {
            return Promise.resolve({
              data: rawify(
                safeBuilder()
                  .with('address', safe.address)
                  .with('owners', [signerAddress])
                  .build(),
              ),
              status: 200,
            });
          }
          if (url === `${chain.transactionService}/api/v2/delegates/`) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', []).build()),
              status: 200,
            });
          }
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      expect(() => jwtService.verify(accessToken)).not.toThrow();
      await request(app.getHttpServer())
        .post(`/v2/register/notifications`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(upsertSubscriptionsDto)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/v2/register/notifications`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(secondSubscriptionDto)
        .expect(201);
    });

    it('should return 422 if the UpsertSubscriptionsDto is invalid', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const upsertSubscriptionsDto = { invalid: 'upsertSubscriptionsDto' };
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .with('chain_id', chainId)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post(`/v2/register/notifications`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(upsertSubscriptionsDto)
        .expect({
          statusCode: 422,
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['cloudMessagingToken'],
          message: 'Required',
        });
    });

    it('should forward datasource errors', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
      const chains = upsertSubscriptionsDto.safes.reduce<Record<string, Chain>>(
        (acc, { chainId }) => {
          if (!acc[chainId]) {
            acc[chainId] = chainBuilder().with('chainId', chainId).build();
          }
          return acc;
        },
        {},
      );
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .with(
          'chain_id',
          faker.helpers.arrayElement(upsertSubscriptionsDto.safes).chainId,
        )
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      networkService.get.mockImplementation(({ url }) => {
        for (const safe of upsertSubscriptionsDto.safes) {
          const chain = chains[safe.chainId];

          if (url === `${safeConfigUrl}/api/v1/chains/${safe.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (
            url === `${chain.transactionService}/api/v1/safes/${safe.address}`
          ) {
            return Promise.resolve({
              data: rawify(
                safeBuilder()
                  .with('address', safe.address)
                  .with('owners', [signerAddress])
                  .build(),
              ),
              status: 200,
            });
          }
          if (url === `${chain.transactionService}/api/v2/delegates/`) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', []).build()),
              status: 200,
            });
          }
        }

        return Promise.reject(new Error(`Could not match ${url}`));
      });
      const error = faker.helpers.arrayElement([
        new UnprocessableEntityException(),
        new NotFoundException(),
      ]);
      notificationsRepository.upsertSubscriptions.mockRejectedValue(error);

      await request(app.getHttpServer())
        .post(`/v2/register/notifications`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(upsertSubscriptionsDto)
        .expect({
          message: error.message,
          statusCode: error.getStatus(),
        });
    });

    describe('authentication', () => {
      it('should upsert with no token', async () => {
        const chainId = faker.string.numeric();
        const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
          .with(
            'safes',
            faker.helpers.multiple(
              () => ({
                chainId,
                address: getAddress(faker.finance.ethereumAddress()),
                notificationTypes: faker.helpers.arrayElements(
                  Object.values(NotificationType),
                ),
              }),
              {
                count: { min: 1, max: 5 },
              },
            ),
          )
          .build();

        await request(app.getHttpServer())
          .post(`/v2/register/notifications`)
          .send(upsertSubscriptionsDto)
          .expect(201);
      });

      it('should return 403 if token is invalid', async () => {
        const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
        const accessToken = faker.string.sample();

        expect(() => jwtService.verify(accessToken)).toThrow('jwt malformed');
        await request(app.getHttpServer())
          .post(`/v2/register/notifications`)
          .set('Cookie', [`access_token=${accessToken}`])
          .send(upsertSubscriptionsDto)
          .expect(403);
      });

      it('should return 403 if there is no signer_address', async () => {
        const chainId = faker.string.numeric();
        const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
          .with(
            'safes',
            faker.helpers.multiple(
              () => ({
                chainId,
                address: getAddress(faker.finance.ethereumAddress()),
                notificationTypes: faker.helpers.arrayElements(
                  Object.values(NotificationType),
                ),
              }),
              {
                count: { min: 1, max: 5 },
              },
            ),
          )
          .build();
        const authPayloadDto = authPayloadDtoBuilder()
          .with('chain_id', chainId)
          .build();
        // @ts-expect-error - we're checking the behavior when the signer_address is missing
        delete authPayloadDto.signer_address;
        const accessToken = jwtService.sign(authPayloadDto);

        expect(() => jwtService.verify(accessToken)).not.toThrow();
        await request(app.getHttpServer())
          .post(`/v2/register/notifications`)
          .set('Cookie', [`access_token=${accessToken}`])
          .send(upsertSubscriptionsDto)
          .expect(403);
      });

      it('should return 403 if there is no chain_id', async () => {
        const chainId = faker.string.numeric();
        const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
          .with(
            'safes',
            faker.helpers.multiple(
              () => ({
                chainId,
                address: getAddress(faker.finance.ethereumAddress()),
                notificationTypes: faker.helpers.arrayElements(
                  Object.values(NotificationType),
                ),
              }),
              {
                count: { min: 1, max: 5 },
              },
            ),
          )
          .build();
        const authPayloadDto = authPayloadDtoBuilder().build();
        // @ts-expect-error - we're checking the behavior when the chain_id is missing
        delete authPayloadDto.chain_id;
        const accessToken = jwtService.sign(authPayloadDto);

        expect(() => jwtService.verify(accessToken)).not.toThrow();
        await request(app.getHttpServer())
          .post(`/v2/register/notifications`)
          .set('Cookie', [`access_token=${accessToken}`])
          .send(upsertSubscriptionsDto)
          .expect(403);
      });

      it('should return 403 if token is not yet valid', async () => {
        const signerAddress = getAddress(faker.finance.ethereumAddress());
        const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
        const authPayloadDto = authPayloadDtoBuilder()
          .with('signer_address', signerAddress)
          .with(
            'chain_id',
            faker.helpers.arrayElement(upsertSubscriptionsDto.safes).chainId,
          )
          .build();
        const accessToken = jwtService.sign({
          ...authPayloadDto,
          nbf: faker.date.future(),
        });

        expect(() => jwtService.verify(accessToken)).toThrow('jwt not active');
        await request(app.getHttpServer())
          .post(`/v2/register/notifications`)
          .set('Cookie', [`access_token=${accessToken}`])
          .send(upsertSubscriptionsDto)
          .expect(403);
      });

      it('should return 403 if token has expired', async () => {
        const signerAddress = getAddress(faker.finance.ethereumAddress());
        const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
        const authPayloadDto = authPayloadDtoBuilder()
          .with('signer_address', signerAddress)
          .with(
            'chain_id',
            faker.helpers.arrayElement(upsertSubscriptionsDto.safes).chainId,
          )
          .build();
        const accessToken = jwtService.sign({
          ...authPayloadDto,
          exp: faker.date.past(),
        });

        expect(() => jwtService.verify(accessToken)).toThrow('jwt expired');
        await request(app.getHttpServer())
          .post(`/v2/register/notifications`)
          .set('Cookie', [`access_token=${accessToken}`])
          .send(upsertSubscriptionsDto)
          .expect(403);
      });
    });
  });

  describe('GET /v2/chains/:chainId/notifications/devices/:deviceUuid/safes/:safeAddress', () => {
    it('should return the subscription for the Safe', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const deviceUuid = faker.string.uuid();
      const notificationTypes = faker.helpers.arrayElements(
        Object.values(NotificationType),
      );
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .with('chain_id', chainId)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      notificationsRepository.getSafeSubscription.mockResolvedValue(
        notificationTypes,
      );

      await request(app.getHttpServer())
        .get(
          `/v2/chains/${chainId}/notifications/devices/${deviceUuid}/safes/${safeAddress}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(notificationTypes);

      expect(notificationsRepository.getSafeSubscription).toHaveBeenCalledTimes(
        1,
      );
      expect(
        notificationsRepository.getSafeSubscription,
      ).toHaveBeenNthCalledWith(1, {
        authPayload: authPayloadDto,
        deviceUuid,
        chainId,
        safeAddress,
      });
    });

    it('should allow subscription retrieval with a token with the same signer_address from a different chain_id', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const deviceUuid = faker.string.uuid();
      const notificationTypes = faker.helpers.arrayElements(
        Object.values(NotificationType),
      );
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .with('chain_id', faker.string.numeric({ exclude: chainId }))
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      notificationsRepository.getSafeSubscription.mockResolvedValue(
        notificationTypes,
      );

      await request(app.getHttpServer())
        .get(
          `/v2/chains/${chainId}/notifications/devices/${deviceUuid}/safes/${safeAddress}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(notificationTypes);

      expect(notificationsRepository.getSafeSubscription).toHaveBeenCalledTimes(
        1,
      );
      expect(
        notificationsRepository.getSafeSubscription,
      ).toHaveBeenNthCalledWith(1, {
        authPayload: {
          chain_id: authPayloadDto.chain_id,
          signer_address: authPayloadDto.signer_address,
        },
        deviceUuid,
        chainId,
        safeAddress,
      });
    });

    it('should return 422 if the deviceUuid is invalid', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const invalidDeviceUuid = faker.string.alphanumeric();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .with('chain_id', chainId)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get(
          `/v2/chains/${chainId}/notifications/devices/${invalidDeviceUuid}/safes/${safeAddress}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect({
          statusCode: 422,
          validation: 'uuid',
          code: 'invalid_string',
          message: 'Invalid UUID',
          path: [],
        });
    });

    it('should return 422 if the chainId is invalid', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const invalidChainId = faker.string.alpha();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const deviceUuid = faker.string.uuid();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .with('chain_id', chainId)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get(
          `/v2/chains/${invalidChainId}/notifications/devices/${deviceUuid}/safes/${safeAddress}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Invalid base-10 numeric string',
          path: [],
        });
    });

    it('should forward datasource errors', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const deviceUuid = faker.string.uuid();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .with('chain_id', chainId)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const error = new NotFoundException();
      notificationsRepository.getSafeSubscription.mockRejectedValue(error);

      await request(app.getHttpServer())
        .get(
          `/v2/chains/${chainId}/notifications/devices/${deviceUuid}/safes/${safeAddress}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect({
          message: error.message,
          statusCode: error.getStatus(),
        });
    });

    describe('authentication', () => {
      it('should return 403 if no token is present', async () => {
        const chainId = faker.string.numeric();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const deviceUuid = faker.string.uuid();

        await request(app.getHttpServer())
          .get(
            `/v2/chains/${chainId}/notifications/devices/${deviceUuid}/safes/${safeAddress}`,
          )
          .expect(403);
      });

      it('should return 403 if token is invalid', async () => {
        const chainId = faker.string.numeric();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const deviceUuid = faker.string.uuid();
        const accessToken = faker.string.sample();

        expect(() => jwtService.verify(accessToken)).toThrow('jwt malformed');
        await request(app.getHttpServer())
          .get(
            `/v2/chains/${chainId}/notifications/devices/${deviceUuid}/safes/${safeAddress}`,
          )
          .set('Cookie', [`access_token=${accessToken}`])
          .expect(403);
      });

      it('should return 403 if there is no signer_address', async () => {
        const chainId = faker.string.numeric();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const deviceUuid = faker.string.uuid();
        const authPayloadDto = authPayloadDtoBuilder()
          .with('chain_id', chainId)
          .build();
        // @ts-expect-error - we're checking the behavior when the signer_address is missing
        delete authPayloadDto.signer_address;
        const accessToken = jwtService.sign(authPayloadDto);

        expect(() => jwtService.verify(accessToken)).not.toThrow();
        await request(app.getHttpServer())
          .get(
            `/v2/chains/${chainId}/notifications/devices/${deviceUuid}/safes/${safeAddress}`,
          )
          .set('Cookie', [`access_token=${accessToken}`])
          .expect(403);
      });

      it('should return 403 if there is no chain_id', async () => {
        const chainId = faker.string.numeric();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const deviceUuid = faker.string.uuid();
        const authPayloadDto = authPayloadDtoBuilder()
          .with('chain_id', chainId)
          .build();
        // @ts-expect-error - we're checking the behavior when the chain_id is missing
        delete authPayloadDto.chain_id;
        const accessToken = jwtService.sign(authPayloadDto);

        expect(() => jwtService.verify(accessToken)).not.toThrow();
        await request(app.getHttpServer())
          .get(
            `/v2/chains/${chainId}/notifications/devices/${deviceUuid}/safes/${safeAddress}`,
          )
          .set('Cookie', [`access_token=${accessToken}`])
          .expect(403);
      });

      it('should return 403 if token is not yet valid', async () => {
        const signerAddress = getAddress(faker.finance.ethereumAddress());
        const chainId = faker.string.numeric();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const deviceUuid = faker.string.uuid();
        const authPayloadDto = authPayloadDtoBuilder()
          .with('signer_address', signerAddress)
          .with('chain_id', chainId)
          .build();
        const accessToken = jwtService.sign({
          ...authPayloadDto,
          nbf: faker.date.future(),
        });

        expect(() => jwtService.verify(accessToken)).toThrow('jwt not active');
        await request(app.getHttpServer())
          .get(
            `/v2/chains/${chainId}/notifications/devices/${deviceUuid}/safes/${safeAddress}`,
          )
          .set('Cookie', [`access_token=${accessToken}`])
          .expect(403);
      });

      it('should return 403 if token has expired', async () => {
        const signerAddress = getAddress(faker.finance.ethereumAddress());
        const chainId = faker.string.numeric();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const deviceUuid = faker.string.uuid();
        const authPayloadDto = authPayloadDtoBuilder()
          .with('signer_address', signerAddress)
          .with('chain_id', chainId)
          .build();
        const accessToken = jwtService.sign({
          ...authPayloadDto,
          exp: faker.date.past(),
        });

        expect(() => jwtService.verify(accessToken)).toThrow('jwt expired');
        await request(app.getHttpServer())
          .get(
            `/v2/chains/${chainId}/notifications/devices/${deviceUuid}/safes/${safeAddress}`,
          )
          .set('Cookie', [`access_token=${accessToken}`])
          .expect(403);
      });
    });
  });

  describe('DELETE /v2/chains/:chainId/notifications/devices/:deviceUuid/safes/:safeAddress', () => {
    it('should delete the subscription for the Safe', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const deviceUuid = faker.string.uuid();

      await request(app.getHttpServer())
        .delete(
          `/v2/chains/${chainId}/notifications/devices/${deviceUuid}/safes/${safeAddress}`,
        )
        .expect(200);

      expect(notificationsRepository.deleteSubscription).toHaveBeenCalledTimes(
        1,
      );
      expect(
        notificationsRepository.deleteSubscription,
      ).toHaveBeenNthCalledWith(1, {
        deviceUuid,
        chainId,
        safeAddress,
      });
    });

    it('should allow subscription deletion with a token with the same signer_address from a different chain_id', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const deviceUuid = faker.string.uuid();

      await request(app.getHttpServer())
        .delete(
          `/v2/chains/${chainId}/notifications/devices/${deviceUuid}/safes/${safeAddress}`,
        )
        .expect(200);
    });

    it('should return 422 if the deviceUuid is invalid', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const invalidDeviceUuid = faker.string.alphanumeric();

      await request(app.getHttpServer())
        .delete(
          `/v2/chains/${chainId}/notifications/devices/${invalidDeviceUuid}/safes/${safeAddress}`,
        )
        .expect({
          statusCode: 422,
          validation: 'uuid',
          code: 'invalid_string',
          message: 'Invalid UUID',
          path: [],
        });
    });

    it('should return 422 if the chainId is invalid', async () => {
      const invalidChainId = faker.string.alpha();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const deviceUuid = faker.string.uuid();

      await request(app.getHttpServer())
        .delete(
          `/v2/chains/${invalidChainId}/notifications/devices/${deviceUuid}/safes/${safeAddress}`,
        )
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Invalid base-10 numeric string',
          path: [],
        });
    });

    it('should forward datasource errors', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const deviceUuid = faker.string.uuid();
      const error = new NotFoundException();
      notificationsRepository.deleteSubscription.mockRejectedValue(error);

      await request(app.getHttpServer())
        .delete(
          `/v2/chains/${chainId}/notifications/devices/${deviceUuid}/safes/${safeAddress}`,
        )
        .expect({
          message: 'Not Found',
          statusCode: 404,
        });
    });
  });

  describe('DELETE /v2/notifications/subscriptions', () => {
    it('Should delete all subscriptions successfully', async () => {
      const deleteAllSubscriptionsDto =
        deleteAllSubscriptionsDtoBuilder().build();

      await request(app.getHttpServer())
        .delete('/v2/notifications/subscriptions')
        .send(deleteAllSubscriptionsDto)
        .expect(200);

      expect(
        notificationsRepository.deleteAllSubscriptions,
      ).toHaveBeenCalledTimes(1);
      expect(
        notificationsRepository.deleteAllSubscriptions,
      ).toHaveBeenNthCalledWith(1, {
        subscriptions: deleteAllSubscriptionsDto.subscriptions,
      });
    });

    it('Should handle empty subscriptions array', async () => {
      const deleteAllSubscriptionsDto: DeleteAllSubscriptionsDto = {
        subscriptions: [],
      };

      await request(app.getHttpServer())
        .delete('/v2/notifications/subscriptions')
        .send(deleteAllSubscriptionsDto)
        .expect(422);

      expect(
        notificationsRepository.deleteAllSubscriptions,
      ).toHaveBeenCalledTimes(0);
    });

    it('Should return 422 if chainId is invalid', async () => {
      const baseDto = deleteAllSubscriptionsDtoBuilder().build();
      const deleteAllSubscriptionsDto = {
        subscriptions: [
          {
            ...baseDto.subscriptions[0],
            chainId: faker.string.alpha(),
          },
        ],
      };

      await request(app.getHttpServer())
        .delete('/v2/notifications/subscriptions')
        .send(deleteAllSubscriptionsDto)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Invalid base-10 numeric string',
          path: ['subscriptions', 0, 'chainId'],
        });
    });

    it('should return 422 if deviceUuid is invalid', async () => {
      const baseDto = deleteAllSubscriptionsDtoBuilder().build();
      const deleteAllSubscriptionsDto = {
        subscriptions: [
          {
            ...baseDto.subscriptions[0],
            deviceUuid: faker.string.alphanumeric(),
          },
        ],
      };

      await request(app.getHttpServer())
        .delete('/v2/notifications/subscriptions')
        .send(deleteAllSubscriptionsDto)
        .expect({
          statusCode: 422,
          validation: 'uuid',
          code: 'invalid_string',
          message: 'Invalid UUID',
          path: ['subscriptions', 0, 'deviceUuid'],
        });
    });

    it('should return 422 if safeAddress is invalid', async () => {
      const baseDto = deleteAllSubscriptionsDtoBuilder().build();
      const deleteAllSubscriptionsDto = {
        subscriptions: [
          {
            ...baseDto.subscriptions[0],
            safeAddress: faker.string.alphanumeric(),
          },
        ],
      };

      await request(app.getHttpServer())
        .delete('/v2/notifications/subscriptions')
        .send(deleteAllSubscriptionsDto)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Invalid address',
          path: ['subscriptions', 0, 'safeAddress'],
        });
    });

    it('should return 422 if required fields are missing', async () => {
      const deleteAllSubscriptionsDto = {
        subscriptions: [
          {
            chainId: faker.string.numeric(),
          },
        ],
      };

      await request(app.getHttpServer())
        .delete('/v2/notifications/subscriptions')
        .send(deleteAllSubscriptionsDto)
        .expect(422);
    });

    it('should forward datasource errors', async () => {
      const deleteAllSubscriptionsDto =
        deleteAllSubscriptionsDtoBuilder().build();
      const error = new NotFoundException();
      notificationsRepository.deleteAllSubscriptions.mockRejectedValue(error);

      await request(app.getHttpServer())
        .delete('/v2/notifications/subscriptions')
        .send(deleteAllSubscriptionsDto)
        .expect({
          message: 'Not Found',
          statusCode: 404,
        });
    });

    it('should handle invalid JSON in request body', async () => {
      await request(app.getHttpServer())
        .delete('/v2/notifications/subscriptions')
        .send('invalid json')
        .expect(422);
    });
  });

  describe('DELETE /v2/chains/:chainId/notifications/devices/:deviceUuid', () => {
    it('should delete the device', async () => {
      const chainId = faker.string.numeric();
      const deviceUuid = faker.string.uuid();

      await request(app.getHttpServer())
        .delete(`/v2/chains/${chainId}/notifications/devices/${deviceUuid}`)
        .expect(200);

      expect(notificationsRepository.deleteDevice).toHaveBeenCalledTimes(1);
      expect(notificationsRepository.deleteDevice).toHaveBeenNthCalledWith(
        1,
        deviceUuid,
      );
    });

    it('should allow device deletion with a token with the same signer_address from a different chain_id', async () => {
      const chainId = faker.string.numeric();
      const deviceUuid = faker.string.uuid();

      await request(app.getHttpServer())
        .delete(`/v2/chains/${chainId}/notifications/devices/${deviceUuid}`)
        .expect(200);

      expect(notificationsRepository.deleteDevice).toHaveBeenCalledTimes(1);
      expect(notificationsRepository.deleteDevice).toHaveBeenNthCalledWith(
        1,
        deviceUuid,
      );
    });

    it('should return 422 if the deviceUuid is invalid', async () => {
      const chainId = faker.string.numeric();
      const invalidDeviceUuid = faker.string.alphanumeric();

      await request(app.getHttpServer())
        .delete(
          `/v2/chains/${chainId}/notifications/devices/${invalidDeviceUuid}`,
        )
        .expect({
          statusCode: 422,
          validation: 'uuid',
          code: 'invalid_string',
          message: 'Invalid UUID',
          path: [],
        });
    });

    it('should return 422 if the chainId is invalid', async () => {
      const invalidChainId = faker.string.alpha();
      const deviceUuid = faker.string.uuid();

      await request(app.getHttpServer())
        .delete(
          `/v2/chains/${invalidChainId}/notifications/devices/${deviceUuid}`,
        )
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Invalid base-10 numeric string',
          path: [],
        });
    });

    it('should forward datasource errors', async () => {
      const chainId = faker.string.numeric();
      const deviceUuid = faker.string.uuid();
      const error = new NotFoundException();
      notificationsRepository.deleteDevice.mockRejectedValue(error);

      await request(app.getHttpServer())
        .delete(`/v2/chains/${chainId}/notifications/devices/${deviceUuid}`)
        .expect({
          message: 'Not Found',
          statusCode: 404,
        });
    });
  });
});
