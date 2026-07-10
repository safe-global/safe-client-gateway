// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { RhinestoneApi } from '@/modules/relay/datasources/rhinestone-api.service';

@Module({
  providers: [
    HttpErrorFactory,
    { provide: IRelayApi, useClass: RhinestoneApi },
  ],
  exports: [IRelayApi],
})
export class RelayApiModule {}
