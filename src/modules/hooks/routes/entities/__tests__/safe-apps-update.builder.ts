// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { ConfigEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import type { SafeAppsUpdate } from '@/modules/hooks/routes/entities/safe-apps-update.entity';

export function safeAppsEventBuilder(): IBuilder<SafeAppsUpdate> {
  return new Builder<SafeAppsUpdate>()
    .with('type', ConfigEventType.SAFE_APPS_UPDATE)
    .with('chainId', faker.string.numeric());
}
