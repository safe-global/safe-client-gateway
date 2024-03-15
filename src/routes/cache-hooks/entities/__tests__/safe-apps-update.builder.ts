import { IBuilder, Builder } from '@/__tests__/builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { SafeAppsUpdate } from '@/routes/cache-hooks/entities/safe-apps-update.entity';
import { faker } from '@faker-js/faker';

export function safeAppsEventBuilder(): IBuilder<SafeAppsUpdate> {
  return new Builder<SafeAppsUpdate>()
    .with('type', EventType.SAFE_APPS_UPDATE)
    .with('chainId', faker.string.numeric());
}
