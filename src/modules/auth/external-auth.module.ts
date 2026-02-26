// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { IExternalAuthDatasource } from '@/modules/auth/datasources/external-auth.datasource.interface';
import { MockExternalAuthDatasource } from '@/modules/auth/datasources/external-auth.mock.datasource';
import { MockConsentController } from '@/modules/auth/routes/mock-consent.controller';

/**
 * Provides {@link IExternalAuthDatasource} bound to the mock implementation
 * and registers {@link MockConsentController} (`GET /v1/auth/mock/consent`).
 *
 * This entire module is swapped for a real-provider module in production — no
 * other code needs to change when the provider decision is made.
 */
@Module({
  providers: [
    {
      provide: IExternalAuthDatasource,
      useClass: MockExternalAuthDatasource,
    },
  ],
  controllers: [MockConsentController],
  exports: [IExternalAuthDatasource],
})
export class ExternalAuthModule {}
