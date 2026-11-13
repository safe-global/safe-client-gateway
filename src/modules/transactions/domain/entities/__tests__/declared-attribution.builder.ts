// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import {
  type DeclaredAttribution,
  KnownDeclaredChannels,
} from '#/modules/transactions/domain/entities/declared-attribution.entity';

export function declaredAttributionBuilder(): IBuilder<DeclaredAttribution> {
  return new Builder<DeclaredAttribution>()
    .with('channel', faker.helpers.arrayElement(KnownDeclaredChannels))
    .with('appName', faker.company.name())
    .with('appUrl', faker.internet.url({ appendSlash: false }))
    .with('appId', faker.number.int({ min: 1, max: 1_000_000 }));
}
