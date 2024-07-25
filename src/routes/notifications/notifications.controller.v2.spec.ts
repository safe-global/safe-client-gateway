import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestAccountsDataSourceModule } from '@/datasources/accounts/__tests__/test.accounts.datasource.module';
import { AccountsDatasourceModule } from '@/datasources/accounts/accounts.datasource.module';
import { TestNotificationsDatasourceModule } from '@/datasources/notifications/__tests__/test.notifications.datasource.module';
import { NotificationsDatasourceModule } from '@/datasources/notifications/notifications.datasource.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import jwtConfiguration from '@/datasources/jwt/configuration/__tests__/jwt.configuration';
import {
  JWT_CONFIGURATION_MODULE,
  JwtConfigurationModule,
} from '@/datasources/jwt/configuration/jwt.configuration.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { delegateBuilder } from '@/domain/delegate/entities/__tests__/delegate.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { INotificationsDatasource } from '@/domain/interfaces/notifications.datasource.interface';
import { NotificationType } from '@/domain/notifications/entities-v2/notification-type.entity';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { upsertSubscriptionsDtoBuilder } from '@/routes/notifications/entities/__tests__/upsert-subscriptions.dto.entity.builder';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'net';
import request from 'supertest';
import { getAddress } from 'viem';

describe('Notifications Controller V2 (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let jwtService: IJwtService;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let notificationsDatasource: jest.MockedObjectDeep<INotificationsDatasource>;

  beforeAll(async () => {
    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        auth: true,
        accounts: true,
        pushNotifications: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(JWT_CONFIGURATION_MODULE)
      .useModule(JwtConfigurationModule.register(jwtConfiguration))
      .overrideModule(AccountsDatasourceModule)
      .useModule(TestAccountsDataSourceModule)
      .overrideModule(NotificationsDatasourceModule)
      .useModule(TestNotificationsDatasourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .compile();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    networkService = moduleFixture.get(NetworkService);
    notificationsDatasource = moduleFixture.get(INotificationsDatasource);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v2/register/notifications', () => {
    it('should upsert subscription(s) for owners', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with(
          'safes',
          Array.from(
            {
              length: faker.number.int({ min: 1, max: 5 }),
            },
            () => ({
              chainId: chain.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
              notificationTypes: faker.helpers.arrayElements(
                Object.values(NotificationType),
              ),
            }),
          ),
        )
        .build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .with('chain_id', chain.chainId)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        for (const safe of upsertSubscriptionsDto.safes) {
          if (
            url === `${chain.transactionService}/api/v1/safes/${safe.address}`
          ) {
            return Promise.resolve({
              data: safeBuilder()
                .with('address', safe.address)
                .with('owners', [signerAddress])
                .build(),
              status: 200,
            });
          }
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            data: pageBuilder().with('results', []).build(),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(`/v2/register/notifications`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(upsertSubscriptionsDto)
        .expect(201);

      expect(notificationsDatasource.upsertSubscriptions).toHaveBeenCalledTimes(
        1,
      );
      expect(
        notificationsDatasource.upsertSubscriptions,
      ).toHaveBeenNthCalledWith(1, {
        signerAddress,
        upsertSubscriptionsDto,
      });
    });

    it('should upsert subscription(s) for delegates', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with(
          'safes',
          Array.from(
            {
              length: faker.number.int({ min: 1, max: 5 }),
            },
            () => ({
              chainId: chain.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
              notificationTypes: faker.helpers.arrayElements(
                Object.values(NotificationType),
              ),
            }),
          ),
        )
        .build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .with('chain_id', chain.chainId)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      networkService.get.mockImplementation(({ url, networkRequest }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        for (const safe of upsertSubscriptionsDto.safes) {
          if (
            url === `${chain.transactionService}/api/v1/safes/${safe.address}`
          ) {
            return Promise.resolve({
              data: safeBuilder().with('address', safe.address).build(),
              status: 200,
            });
          }
          if (
            url === `${chain.transactionService}/api/v2/delegates/` &&
            networkRequest?.params?.safe === safe.address
          ) {
            return Promise.resolve({
              data: pageBuilder()
                .with('results', [
                  delegateBuilder().with('delegate', signerAddress).build(),
                ])
                .build(),
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

      expect(notificationsDatasource.upsertSubscriptions).toHaveBeenCalledTimes(
        1,
      );
      expect(
        notificationsDatasource.upsertSubscriptions,
      ).toHaveBeenNthCalledWith(1, {
        signerAddress,
        upsertSubscriptionsDto,
      });
    });

    it('should allow subscription upsertion with a token with the same signer_address from a different chain_id', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with(
          'safes',
          Array.from(
            {
              length: faker.number.int({ min: 1, max: 5 }),
            },
            () => ({
              chainId: chain.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
              notificationTypes: faker.helpers.arrayElements(
                Object.values(NotificationType),
              ),
            }),
          ),
        )
        .build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .with('chain_id', faker.string.numeric({ exclude: chain.chainId }))
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        for (const safe of upsertSubscriptionsDto.safes) {
          if (
            url === `${chain.transactionService}/api/v1/safes/${safe.address}`
          ) {
            return Promise.resolve({
              data: safeBuilder()
                .with('address', safe.address)
                .with('owners', [signerAddress])
                .build(),
              status: 200,
            });
          }
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            data: pageBuilder().with('results', []).build(),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      expect(() => jwtService.verify(accessToken)).not.toThrow();
      await request(app.getHttpServer())
        .post(`/v2/register/notifications`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(upsertSubscriptionsDto)
        .expect(201);

      expect(notificationsDatasource.upsertSubscriptions).toHaveBeenCalledTimes(
        1,
      );
      expect(
        notificationsDatasource.upsertSubscriptions,
      ).toHaveBeenNthCalledWith(1, {
        signerAddress,
        upsertSubscriptionsDto,
      });
    });

    it('should allow subscription(s) to the same Safe with different devices', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
        .with(
          'safes',
          Array.from(
            {
              length: faker.number.int({ min: 1, max: 5 }),
            },
            () => ({
              chainId: chain.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
              notificationTypes: faker.helpers.arrayElements(
                Object.values(NotificationType),
              ),
            }),
          ),
        )
        .build();
      const secondSubscriptionDto = upsertSubscriptionsDtoBuilder()
        .with('safes', upsertSubscriptionsDto.safes)
        .with('deviceUuid', null)
        .build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .with('chain_id', chain.chainId)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        for (const safe of upsertSubscriptionsDto.safes) {
          if (
            url === `${chain.transactionService}/api/v1/safes/${safe.address}`
          ) {
            return Promise.resolve({
              data: safeBuilder()
                .with('address', safe.address)
                .with('owners', [signerAddress])
                .build(),
              status: 200,
            });
          }
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            data: pageBuilder().with('results', []).build(),
            status: 200,
          });
        }
        for (const safe of secondSubscriptionDto.safes) {
          if (
            url === `${chain.transactionService}/api/v1/safes/${safe.address}`
          ) {
            return Promise.resolve({
              data: safeBuilder()
                .with('address', safe.address)
                .with('owners', [signerAddress])
                .build(),
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

      expect(notificationsDatasource.upsertSubscriptions).toHaveBeenCalledTimes(
        2,
      );
      expect(
        notificationsDatasource.upsertSubscriptions,
      ).toHaveBeenNthCalledWith(1, {
        signerAddress,
        upsertSubscriptionsDto,
      });
      expect(
        notificationsDatasource.upsertSubscriptions,
      ).toHaveBeenNthCalledWith(2, {
        signerAddress,
        upsertSubscriptionsDto: secondSubscriptionDto,
      });
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

      expect(() => jwtService.verify(accessToken)).not.toThrow();
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

    describe('authentication', () => {
      it('should return 403 if there is no signer_address', async () => {
        const chainId = faker.string.numeric();
        const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
          .with(
            'safes',
            Array.from(
              {
                length: faker.number.int({ min: 1, max: 5 }),
              },
              () => ({
                chainId,
                address: getAddress(faker.finance.ethereumAddress()),
                notificationTypes: faker.helpers.arrayElements(
                  Object.values(NotificationType),
                ),
              }),
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
            Array.from(
              {
                length: faker.number.int({ min: 1, max: 5 }),
              },
              () => ({
                chainId,
                address: getAddress(faker.finance.ethereumAddress()),
                notificationTypes: faker.helpers.arrayElements(
                  Object.values(NotificationType),
                ),
              }),
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

      it('should return 403 if no token is present', async () => {
        const chainId = faker.string.numeric();
        const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
          .with(
            'safes',
            Array.from(
              {
                length: faker.number.int({ min: 1, max: 5 }),
              },
              () => ({
                chainId,
                address: getAddress(faker.finance.ethereumAddress()),
                notificationTypes: faker.helpers.arrayElements(
                  Object.values(NotificationType),
                ),
              }),
            ),
          )
          .build();

        await request(app.getHttpServer())
          .post(`/v2/register/notifications`)
          .send(upsertSubscriptionsDto)
          .expect(403);
      });

      it('should return 403 if token is invalid', async () => {
        const chainId = faker.string.numeric();
        const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
          .with(
            'safes',
            Array.from(
              {
                length: faker.number.int({ min: 1, max: 5 }),
              },
              () => ({
                chainId,
                address: getAddress(faker.finance.ethereumAddress()),
                notificationTypes: faker.helpers.arrayElements(
                  Object.values(NotificationType),
                ),
              }),
            ),
          )
          .build();
        const accessToken = faker.string.sample();

        expect(() => jwtService.verify(accessToken)).toThrow('jwt malformed');
        await request(app.getHttpServer())
          .post(`/v2/register/notifications`)
          .set('Cookie', [`access_token=${accessToken}`])
          .send(upsertSubscriptionsDto)
          .expect(403);
      });

      it('should return 403 if token is not yet valid', async () => {
        const signerAddress = getAddress(faker.finance.ethereumAddress());
        const chainId = faker.string.numeric();
        const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
          .with(
            'safes',
            Array.from(
              {
                length: faker.number.int({ min: 1, max: 5 }),
              },
              () => ({
                chainId,
                address: getAddress(faker.finance.ethereumAddress()),
                notificationTypes: faker.helpers.arrayElements(
                  Object.values(NotificationType),
                ),
              }),
            ),
          )
          .build();
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
          .post(`/v2/register/notifications`)
          .set('Cookie', [`access_token=${accessToken}`])
          .send(upsertSubscriptionsDto)
          .expect(403);
      });

      it('should return 403 if token has expired', async () => {
        const signerAddress = getAddress(faker.finance.ethereumAddress());
        const chainId = faker.string.numeric();
        const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
          .with(
            'safes',
            Array.from(
              {
                length: faker.number.int({ min: 1, max: 5 }),
              },
              () => ({
                chainId,
                address: getAddress(faker.finance.ethereumAddress()),
                notificationTypes: faker.helpers.arrayElements(
                  Object.values(NotificationType),
                ),
              }),
            ),
          )
          .build();
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
          .post(`/v2/register/notifications`)
          .set('Cookie', [`access_token=${accessToken}`])
          .send(upsertSubscriptionsDto)
          .expect(403);
      });
    });
  });

  describe.skip('GET /v2/chains/:chainId/notifications/devices/:deviceUuid/safes/:safeAddress', () => {
    it.todo('should return the subscription for the Safe');

    it.todo('should return 422 if the account is invalid');

    it.todo('should return XXX if the device can not be found');

    it.todo('should return XXX if the safe can not be found');

    describe('authentication', () => {
      it.todo(
        'should allow preference retrieval with a token with the same signer_address from a different chain_id',
      );

      it.todo('should return 403 if there is no signer_address');

      it.todo('should return 403 if there is no chain_id');

      it.todo('should return 403 if no token is present');

      it.todo('should return 403 if token is invalid');

      it.todo('should return 403 if token is not yet valid');

      it.todo('should return 403 if token has expired');
    });
  });

  describe.skip('DELETE /v2/chains/:chainId/notifications/devices/:deviceUuid/safes/:safeAddress', () => {
    it.todo('should delete the subscription for the Safe');

    it.todo('should not delete subscriptions of other devices');

    it.todo('should not delete the device if it has other subscriptions');

    it.todo('should return 422 if the account is invalid');

    it.todo('should return XXX if the device can not be found');

    it.todo('should return XXX if the safe can not be found');
  });

  describe.skip('DELETE /v2/chains/:chainId/notifications/devices/:deviceUuid', () => {
    it.todo('should delete all subscriptions of the device');

    it.todo('should return 422 if the account is invalid');

    it.todo('should return XXX if the device can not be found');
  });
});
