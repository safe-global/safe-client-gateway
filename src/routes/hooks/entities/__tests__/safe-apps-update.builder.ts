import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { ConfigEventType } from '@/routes/hooks/entities/event-type.entity';
import type { SafeAppsUpdate } from '@/routes/hooks/entities/safe-apps-update.entity';
import { faker } from '@faker-js/faker';

export function safeAppsEventBuilder(): IBuilder<SafeAppsUpdate> {
  return new Builder<SafeAppsUpdate>()
    .with('type', ConfigEventType.SAFE_APPS_UPDATE)
    .with('chainId', faker.string.numeric());
}
