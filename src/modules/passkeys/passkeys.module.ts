// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { PasskeyCoordinates } from '@/modules/passkeys/datasources/entities/passkey-coordinates.entity.db';
import { PasskeysRepository } from '@/modules/passkeys/domain/passkeys.repository';
import { IPasskeysRepository } from '@/modules/passkeys/domain/passkeys.repository.interface';
import { PasskeysController } from '@/modules/passkeys/routes/passkeys.controller';
import { PasskeysService } from '@/modules/passkeys/routes/passkeys.service';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([PasskeyCoordinates]),
  ],
  controllers: [PasskeysController],
  providers: [
    PasskeysService,
    {
      provide: IPasskeysRepository,
      useClass: PasskeysRepository,
    },
  ],
  exports: [IPasskeysRepository],
})
export class PasskeysModule implements OnModuleInit {
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
  public onModuleInit(): void {
    for (const key of [
      'passkeys.rpIdAllowlist',
      'passkeys.originAllowlist',
      'passkeys.verifiersAllowlist',
    ]) {
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
