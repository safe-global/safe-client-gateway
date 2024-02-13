import { Module } from '@nestjs/common';
import { GelatoRelay } from '@gelatonetwork/relay-sdk';
import { GelatoApi } from '@/datasources/relay-api/gelato-api.service';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';

@Module({
  providers: [
    {
      provide: 'GelatoRelayClient',
      useFactory: () => new GelatoRelay(),
    },
    { provide: IRelayApi, useClass: GelatoApi },
  ],
  exports: [IRelayApi],
})
export class RelayApiModule {}
