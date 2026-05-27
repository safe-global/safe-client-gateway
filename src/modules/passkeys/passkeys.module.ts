// SPDX-License-Identifier: FSL-1.1-MIT

import {
  Inject,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  OnModuleInit,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { json } from 'express';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { PasskeyCoordinates } from '@/modules/passkeys/datasources/entities/passkey-coordinates.entity.db';
import { PasskeyAttestationService } from '@/modules/passkeys/domain/passkey-attestation.service';
import { PasskeysRepository } from '@/modules/passkeys/domain/passkeys.repository';
import { IPasskeysRepository } from '@/modules/passkeys/domain/passkeys.repository.interface';
import { PasskeysLookupRateLimitGuard } from '@/modules/passkeys/routes/guards/passkeys-lookup-rate-limit.guard';
import { PasskeysRegistrationRateLimitGuard } from '@/modules/passkeys/routes/guards/passkeys-registration-rate-limit.guard';
import { PasskeysLookupCacheInterceptor } from '@/modules/passkeys/routes/interceptors/passkeys-lookup-cache.interceptor';
import { PasskeysController } from '@/modules/passkeys/routes/passkeys.controller';
import { PasskeysService } from '@/modules/passkeys/routes/passkeys.service';

// Tight per-route body cap. Sized to ~1.5× the realistic worst-case attestation
// (TPM with cert chain, ~10 KiB encoded). Anything larger is malformed or
// hostile — bound CBOR-bomb DoS that the rate limit alone would not stop.
const PASSKEYS_BODY_LIMIT = '24kb';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([PasskeyCoordinates]),
  ],
  controllers: [PasskeysController],
  providers: [
    PasskeysService,
    PasskeyAttestationService,
    PasskeysRegistrationRateLimitGuard,
    PasskeysLookupRateLimitGuard,
    PasskeysLookupCacheInterceptor,
    {
      provide: IPasskeysRepository,
      useClass: PasskeysRepository,
    },
  ],
  exports: [IPasskeysRepository],
})
export class PasskeysModule implements NestModule, OnModuleInit {
  public constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  /**
   * Fail-closed bootstrap: if the feature flag is on but any allowlist is
   * empty, refuse to start. Prevents a future refactor from accidentally
   * introducing "skip check when allowlist empty" semantics — that would be a
   * silent fail-open across origin / RP-ID / verifier validation.
   */
  public configure(consumer: MiddlewareConsumer): void {
    // Bind directly to the controller class instead of a path string. NestJS
    // resolves the version-prefixed URL ('/v1/passkeys') automatically; using
    // a string here is brittle to versioning changes.
    consumer
      .apply(json({ limit: PASSKEYS_BODY_LIMIT }))
      .forRoutes(PasskeysController);
  }

  public onModuleInit(): void {
    for (const key of ['passkeys.rpIdAllowlist', 'passkeys.originAllowlist']) {
      const list =
        this.configurationService.getOrThrow<ReadonlyArray<string>>(key);
      if (list.length === 0) {
        throw new Error(
          `Configuration "${key}" must be non-empty when FF_PASSKEYS=true`,
        );
      }
    }
  }
}
