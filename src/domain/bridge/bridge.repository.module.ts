import { Module } from '@nestjs/common';
import { BridgeApiModule } from '@/datasources/bridge-api/bridge-api.module';
import { BridgeRepository } from '@/domain/bridge/bridge.repository';
import { IBridgeRepository } from '@/domain/bridge/bridge.repository.interface';

@Module({
  imports: [BridgeApiModule],
  providers: [{ provide: IBridgeRepository, useClass: BridgeRepository }],
  exports: [IBridgeRepository],
})
export class BridgeRepositoryModule {}
