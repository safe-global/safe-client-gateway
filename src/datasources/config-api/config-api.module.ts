// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ConfigApi } from '#/datasources/config-api/config-api.service';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { SafeInternalNetworkModule } from '#/datasources/network/safe-internal.network.module';
import { IConfigApi } from '#/domain/interfaces/config-api.interface';

@Module({
  imports: [SafeInternalNetworkModule],
  providers: [HttpErrorFactory, { provide: IConfigApi, useClass: ConfigApi }],
  exports: [IConfigApi],
})
export class ConfigApiModule {}
