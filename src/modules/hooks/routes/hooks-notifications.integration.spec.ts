// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import {
  IHooksRepository,
  type IHooksRepository as IHooksRepositoryType,
} from '@/modules/hooks/domain/hooks.repository.interface';
import { chainUpdateEventBuilder } from '@/modules/hooks/routes/entities/__tests__/chain-update.builder';
import {
  deletedDelegateEventBuilder,
  newDelegateEventBuilder,
  updatedDelegateEventBuilder,
} from '@/modules/hooks/routes/entities/__tests__/delegate-events.builder';
import { deletedMultisigTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/deleted-multisig-transaction.builder';
import { executedTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/executed-transaction.builder';
import { incomingEtherEventBuilder } from '@/modules/hooks/routes/entities/__tests__/incoming-ether.builder';
import { incomingTokenEventBuilder } from '@/modules/hooks/routes/entities/__tests__/incoming-token.builder';
import { messageCreatedEventBuilder } from '@/modules/hooks/routes/entities/__tests__/message-created.builder';
import { moduleTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/module-transaction.builder';
import { newConfirmationEventBuilder } from '@/modules/hooks/routes/entities/__tests__/new-confirmation.builder';
import { newMessageConfirmationEventBuilder } from '@/modules/hooks/routes/entities/__tests__/new-message-confirmation.builder';
import { outgoingEtherEventBuilder } from '@/modules/hooks/routes/entities/__tests__/outgoing-ether.builder';
import { outgoingTokenEventBuilder } from '@/modules/hooks/routes/entities/__tests__/outgoing-token.builder';
import { pendingTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/pending-transaction.builder';
import { reorgDetectedEventBuilder } from '@/modules/hooks/routes/entities/__tests__/reorg-detected.builder';
import { safeAppsEventBuilder } from '@/modules/hooks/routes/entities/__tests__/safe-apps-update.builder';
import { safeCreatedEventBuilder } from '@/modules/hooks/routes/entities/__tests__/safe-created.build';
import { IPushNotificationService } from '@/modules/notifications/domain/push/push-notification.service.interface';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { rawify } from '@/validation/entities/raw.entity';

describe('Hook Events for Notifications', () => {
  let app: INestApplication<Server>;
  let hooksRepository: IHooksRepositoryType;
  let pushNotificationService: jest.MockedObjectDeep<IPushNotificationService>;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let configurationService: IConfigurationService;
  let safeConfigUrl: string;

  async function initApp(): Promise<void> {
    const moduleFixture = await createTestModule({
      config: configuration,
      modules: [
        {
          originalModule: NotificationsRepositoryV2Module,
          testModule: TestNotificationsRepositoryV2Module,
        },
      ],
    });

    app = moduleFixture.createNestApplication();

    hooksRepository = moduleFixture.get(IHooksRepository);
    networkService = moduleFixture.get(NetworkService);
    configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    pushNotificationService = moduleFixture.get(IPushNotificationService);

    await app.init();
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    await initApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(
    [
      safeAppsEventBuilder().build(),
      outgoingEtherEventBuilder().build(),
      outgoingTokenEventBuilder().build(),
      newConfirmationEventBuilder().build(),
      newMessageConfirmationEventBuilder().build(),
      safeCreatedEventBuilder().build(),
      reorgDetectedEventBuilder().build(),
      newDelegateEventBuilder().build(),
      updatedDelegateEventBuilder().build(),
      deletedDelegateEventBuilder().build(),
    ].map((event) => [event.type, event]),
  )('should not enqueue %s events when chain is unsupported', async (_, event) => {
    await hooksRepository.onEvent(event);

    expect(pushNotificationService.enqueueEvent).not.toHaveBeenCalled();
  });

  it('should enqueue CHAIN_UPDATE events regardless of chain support', async () => {
    const event = chainUpdateEventBuilder().build();

    await hooksRepository.onEvent(event);

    expect(pushNotificationService.enqueueEvent).toHaveBeenCalledWith(event);
  });

  it.each(
    [
      safeAppsEventBuilder().build(),
      outgoingEtherEventBuilder().build(),
      outgoingTokenEventBuilder().build(),
      newConfirmationEventBuilder().build(),
      newMessageConfirmationEventBuilder().build(),
      safeCreatedEventBuilder().build(),
      reorgDetectedEventBuilder().build(),
      newDelegateEventBuilder().build(),
      deletedMultisigTransactionEventBuilder().build(),
      executedTransactionEventBuilder().build(),
      moduleTransactionEventBuilder().build(),
      incomingEtherEventBuilder().build(),
      incomingTokenEventBuilder().build(),
      pendingTransactionEventBuilder().build(),
      messageCreatedEventBuilder().build(),
    ].map((event) => [event.type, event]),
  )('should enqueue %s events for supported chains', async (_, event) => {
    const chain = chainBuilder().with('chainId', event.chainId).build();
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await hooksRepository.onEvent(event);

    expect(pushNotificationService.enqueueEvent).toHaveBeenCalledWith(event);
  });
});
