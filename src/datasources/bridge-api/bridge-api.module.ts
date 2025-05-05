import { Module } from '@nestjs/common';
import { BridgeApiFactory } from '@/datasources/bridge-api/bridge-api.factory';
import { IBridgeApiFactory } from '@/domain/interfaces/bridge-api.factory.interface';

@Module({
  providers: [{ provide: IBridgeApiFactory, useClass: BridgeApiFactory }],
  exports: [IBridgeApiFactory],
})
export class BridgeApiModule {}
