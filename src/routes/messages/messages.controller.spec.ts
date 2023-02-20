import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { random, range } from 'lodash';
import * as request from 'supertest';
import { TestAppProvider } from '../../app.provider';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../config/__tests__/test.configuration.module';
import {
  fakeCacheService,
  TestCacheModule,
} from '../../datasources/cache/__tests__/test.cache.module';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../datasources/network/__tests__/test.network.module';
import { DomainModule } from '../../domain.module';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { messageConfirmationBuilder } from '../../domain/messages/entities/__tests__/message-confirmation.builder';
import {
  messageBuilder,
  toJson as messageToJson,
} from '../../domain/messages/entities/__tests__/message.builder';
import { safeAppBuilder } from '../../domain/safe-apps/entities/__tests__/safe-app.builder';
import { safeBuilder } from '../../domain/safe/entities/__tests__/safe.builder';
import { ValidationModule } from '../../validation.module';
import { MessageStatus } from './entities/message.entity';
import { MessagesModule } from './messages.module';

describe('Messages controller', () => {
  let app: INestApplication;

  const safeConfigUrl = faker.internet.url();

  beforeAll(async () => {
    fakeConfigurationService.set('safeConfig.baseUri', safeConfigUrl);
    fakeConfigurationService.set('exchange.baseUri', faker.internet.url());
    fakeConfigurationService.set(
      'exchange.apiKey',
      faker.random.alphaNumeric(),
    );
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeCacheService.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        MessagesModule,
        // common
        DomainModule,
        TestCacheModule,
        TestConfigurationModule,
        TestNetworkModule,
        ValidationModule,
      ],
    }).compile();

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  describe('GET messages by hash', () => {
    it('Get a confirmed message with no safe app associated', async () => {
      const chain = chainBuilder().build();
      const safeApps = [];
      const messageConfirmations = range(random(2, 5)).map(() =>
        messageConfirmationBuilder().build(),
      );
      const message = messageBuilder()
        .with('confirmations', messageConfirmations)
        .build();
      const safe = safeBuilder()
        .with(
          'threshold',
          faker.datatype.number({ max: messageConfirmations.length }),
        )
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/messages/${message.messageHash}`:
            return Promise.resolve({ data: messageToJson(message) });
          case `${chain.transactionService}/api/v1/safes/${message.safe}`:
            return Promise.resolve({ data: safe });
          case `${safeConfigUrl}/api/v1/safe-apps/`:
            return Promise.resolve({ data: safeApps });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/messages/${message.messageHash}`)
        .expect(200)
        .expect({
          messageHash: message.messageHash,
          status: MessageStatus.Confirmed,
          logoUri: null,
          name: null,
          message: message.message,
          creationTimestamp: message.created.getTime(),
          modifiedTimestamp: message.modified.getTime(),
          confirmationsSubmitted: messageConfirmations.length,
          confirmationsRequired: safe.threshold,
          proposedBy: {
            value: message.proposedBy,
            name: null,
            logoUri: null,
          },
          confirmations: messageConfirmations.map((confirmation) => ({
            owner: {
              value: confirmation.owner,
              name: null,
              logoUri: null,
            },
            signature: confirmation.signature,
          })),
          preparedSignature: message.preparedSignature,
        });
    });

    it('Get a confirmed message with a safe app associated', async () => {
      const chain = chainBuilder().build();
      const safeApps = range(random(2, 5)).map(() => safeAppBuilder().build());
      const messageConfirmations = range(random(2, 5)).map(() =>
        messageConfirmationBuilder().build(),
      );
      const message = messageBuilder()
        .with('safeAppId', safeApps[1].id)
        .with('confirmations', messageConfirmations)
        .build();
      const safe = safeBuilder()
        .with(
          'threshold',
          faker.datatype.number({ max: messageConfirmations.length }),
        )
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/messages/${message.messageHash}`:
            return Promise.resolve({ data: messageToJson(message) });
          case `${chain.transactionService}/api/v1/safes/${message.safe}`:
            return Promise.resolve({ data: safe });
          case `${safeConfigUrl}/api/v1/safe-apps/`:
            return Promise.resolve({ data: safeApps });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/messages/${message.messageHash}`)
        .expect(200)
        .expect({
          messageHash: message.messageHash,
          status: MessageStatus.Confirmed,
          logoUri: safeApps[1].iconUrl,
          name: safeApps[1].name,
          message: message.message,
          creationTimestamp: message.created.getTime(),
          modifiedTimestamp: message.modified.getTime(),
          confirmationsSubmitted: messageConfirmations.length,
          confirmationsRequired: safe.threshold,
          proposedBy: {
            value: message.proposedBy,
            name: null,
            logoUri: null,
          },
          confirmations: messageConfirmations.map((confirmation) => ({
            owner: {
              value: confirmation.owner,
              name: null,
              logoUri: null,
            },
            signature: confirmation.signature,
          })),
          preparedSignature: message.preparedSignature,
        });
    });

    it('Get an unconfirmed message with no safe app associated', async () => {
      const chain = chainBuilder().build();
      const safeApps = [];
      const messageConfirmations = range(random(2, 5)).map(() =>
        messageConfirmationBuilder().build(),
      );
      const message = messageBuilder()
        .with('confirmations', messageConfirmations)
        .build();
      const safe = safeBuilder()
        .with(
          'threshold',
          faker.datatype.number({ min: messageConfirmations.length + 1 }),
        )
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/messages/${message.messageHash}`:
            return Promise.resolve({ data: messageToJson(message) });
          case `${chain.transactionService}/api/v1/safes/${message.safe}`:
            return Promise.resolve({ data: safe });
          case `${safeConfigUrl}/api/v1/safe-apps/`:
            return Promise.resolve({ data: safeApps });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/messages/${message.messageHash}`)
        .expect(200)
        .expect({
          messageHash: message.messageHash,
          status: MessageStatus.NeedsConfirmation,
          logoUri: null,
          name: null,
          message: message.message,
          creationTimestamp: message.created.getTime(),
          modifiedTimestamp: message.modified.getTime(),
          confirmationsSubmitted: messageConfirmations.length,
          confirmationsRequired: safe.threshold,
          proposedBy: {
            value: message.proposedBy,
            name: null,
            logoUri: null,
          },
          confirmations: messageConfirmations.map((confirmation) => ({
            owner: {
              value: confirmation.owner,
              name: null,
              logoUri: null,
            },
            signature: confirmation.signature,
          })),
          preparedSignature: null,
        });
    });

    it('Get an unconfirmed message with a safe app associated', async () => {
      const chain = chainBuilder().build();
      const safeApps = range(random(3, 5)).map(() => safeAppBuilder().build());
      const messageConfirmations = range(random(2, 5)).map(() =>
        messageConfirmationBuilder().build(),
      );
      const message = messageBuilder()
        .with('safeAppId', safeApps[2].id)
        .with('confirmations', messageConfirmations)
        .build();
      const safe = safeBuilder()
        .with(
          'threshold',
          faker.datatype.number({ min: messageConfirmations.length + 1 }),
        )
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/messages/${message.messageHash}`:
            return Promise.resolve({ data: messageToJson(message) });
          case `${chain.transactionService}/api/v1/safes/${message.safe}`:
            return Promise.resolve({ data: safe });
          case `${safeConfigUrl}/api/v1/safe-apps/`:
            return Promise.resolve({ data: safeApps });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/messages/${message.messageHash}`)
        .expect(200)
        .expect({
          messageHash: message.messageHash,
          status: MessageStatus.NeedsConfirmation,
          logoUri: safeApps[2].iconUrl,
          name: safeApps[2].name,
          message: message.message,
          creationTimestamp: message.created.getTime(),
          modifiedTimestamp: message.modified.getTime(),
          confirmationsSubmitted: messageConfirmations.length,
          confirmationsRequired: safe.threshold,
          proposedBy: {
            value: message.proposedBy,
            name: null,
            logoUri: null,
          },
          confirmations: messageConfirmations.map((confirmation) => ({
            owner: {
              value: confirmation.owner,
              name: null,
              logoUri: null,
            },
            signature: confirmation.signature,
          })),
          preparedSignature: null,
        });
    });

    it('should return null name and logo if the Safe App is not found', async () => {
      const chain = chainBuilder().build();
      const messageConfirmations = range(random(2, 5)).map(() =>
        messageConfirmationBuilder().build(),
      );
      const message = messageBuilder()
        .with('safeAppId', faker.datatype.number())
        .with('confirmations', messageConfirmations)
        .build();
      const safe = safeBuilder()
        .with(
          'threshold',
          faker.datatype.number({ min: messageConfirmations.length + 1 }),
        )
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/messages/${message.messageHash}`:
            return Promise.resolve({ data: messageToJson(message) });
          case `${chain.transactionService}/api/v1/safes/${message.safe}`:
            return Promise.resolve({ data: safe });
          case `${safeConfigUrl}/api/v1/safe-apps/`:
            return Promise.resolve({ data: [] });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/messages/${message.messageHash}`)
        .expect(200)
        .expect({
          messageHash: message.messageHash,
          status: MessageStatus.NeedsConfirmation,
          logoUri: null,
          name: null,
          message: message.message,
          creationTimestamp: message.created.getTime(),
          modifiedTimestamp: message.modified.getTime(),
          confirmationsSubmitted: messageConfirmations.length,
          confirmationsRequired: safe.threshold,
          proposedBy: {
            value: message.proposedBy,
            name: null,
            logoUri: null,
          },
          confirmations: messageConfirmations.map((confirmation) => ({
            owner: {
              value: confirmation.owner,
              name: null,
              logoUri: null,
            },
            signature: confirmation.signature,
          })),
          preparedSignature: null,
        });
    });

    it('should return null name and logo if no safeAppId in the message', async () => {
      const chain = chainBuilder().build();
      const messageConfirmations = range(random(2, 5)).map(() =>
        messageConfirmationBuilder().build(),
      );
      const message = messageBuilder()
        .with('safeAppId', null)
        .with('confirmations', messageConfirmations)
        .build();
      const safe = safeBuilder()
        .with(
          'threshold',
          faker.datatype.number({ min: messageConfirmations.length + 1 }),
        )
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/messages/${message.messageHash}`:
            return Promise.resolve({ data: messageToJson(message) });
          case `${chain.transactionService}/api/v1/safes/${message.safe}`:
            return Promise.resolve({ data: safe });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/messages/${message.messageHash}`)
        .expect(200)
        .expect({
          messageHash: message.messageHash,
          status: MessageStatus.NeedsConfirmation,
          logoUri: null,
          name: null,
          message: message.message,
          creationTimestamp: message.created.getTime(),
          modifiedTimestamp: message.modified.getTime(),
          confirmationsSubmitted: messageConfirmations.length,
          confirmationsRequired: safe.threshold,
          proposedBy: {
            value: message.proposedBy,
            name: null,
            logoUri: null,
          },
          confirmations: messageConfirmations.map((confirmation) => ({
            owner: {
              value: confirmation.owner,
              name: null,
              logoUri: null,
            },
            signature: confirmation.signature,
          })),
          preparedSignature: null,
        });
    });
  });
});
