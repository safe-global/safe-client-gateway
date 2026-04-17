// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { deletedMultisigTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/deleted-multisig-transaction.builder';
import { executedTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/executed-transaction.builder';
import { incomingEtherEventBuilder } from '@/modules/hooks/routes/entities/__tests__/incoming-ether.builder';
import { incomingTokenEventBuilder } from '@/modules/hooks/routes/entities/__tests__/incoming-token.builder';
import { messageCreatedEventBuilder } from '@/modules/hooks/routes/entities/__tests__/message-created.builder';
import { moduleTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/module-transaction.builder';
import { pendingTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/pending-transaction.builder';
import type { PushNotificationEventJobData } from '@/modules/notifications/domain/push/entities/push-notification-job-data.entity';

const eventBuilders = [
  incomingTokenEventBuilder,
  incomingEtherEventBuilder,
  executedTransactionEventBuilder,
  deletedMultisigTransactionEventBuilder,
  moduleTransactionEventBuilder,
  pendingTransactionEventBuilder,
  messageCreatedEventBuilder,
];

export function pushNotificationEventJobDataBuilder(): IBuilder<PushNotificationEventJobData> {
  return new Builder<PushNotificationEventJobData>().with(
    'event',
    faker.helpers.arrayElement(eventBuilders)().build(),
  );
}
