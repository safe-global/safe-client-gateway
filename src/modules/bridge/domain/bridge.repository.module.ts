import { Module } from '@nestjs/common';
import { BridgeApiModule } from '@/modules/bridge/datasources/bridge-api.module';
import { BridgeRepository } from '@/modules/bridge/domain/bridge.repository';
import { IBridgeRepository } from '@/modules/bridge/domain/bridge.repository.interface';

@Module({
  imports: [BridgeApiModule],
  providers: [{ provide: IBridgeRepository, useClass: BridgeRepository }],
  exports: [IBridgeRepository],
})
export class BridgeRepositoryModule {}
