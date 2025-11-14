import { Module } from '@nestjs/common';
import { PositionsController } from '@/modules/positions/routes/positions.controller';
import { PositionsService } from '@/modules/positions/routes/positions.service';
import { PositionsRepositoryModule } from '@/modules/positions/domain/positions.repository.interface';
import { ChainsRepositoryModule } from '@/modules/chains/domain/chains.repository.interface';

@Module({
  imports: [PositionsRepositoryModule, ChainsRepositoryModule],
  controllers: [PositionsController],
  providers: [PositionsService],
})
export class PositionsModule {}
