import { Module } from '@nestjs/common';
import { PositionsController } from '@/modules/positions/routes/positions.controller';
import { PositionsService } from '@/modules/positions/routes/positions.service';
import { PositionsRepositoryModule } from '@/modules/positions/domain/positions.repository.interface';
import { ChainsModule } from '@/modules/chains/chains.module';

@Module({
  imports: [PositionsRepositoryModule, ChainsModule],
  controllers: [PositionsController],
  providers: [PositionsService],
})
export class PositionsModule {}
