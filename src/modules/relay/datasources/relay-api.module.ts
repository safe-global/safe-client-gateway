import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { GelatoApi } from '@/modules/relay/datasources/gelato-api.service';

@Module({
  providers: [HttpErrorFactory, { provide: IRelayApi, useClass: GelatoApi }],
  exports: [IRelayApi],
})
export class RelayApiModule {}
