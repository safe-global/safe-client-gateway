import { Module } from '@nestjs/common';
import { GelatoApi } from '@/modules/relay/datasources/gelato-api.service';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';

@Module({
  providers: [HttpErrorFactory, { provide: IRelayApi, useClass: GelatoApi }],
  exports: [IRelayApi],
})
export class RelayApiModule {}
