import { Module } from '@nestjs/common';
import { PositionsController } from '@/routes/positions/positions.controller';
import { PositionsService } from '@/routes/positions/positions.service';
import { PositionsRepositoryModule } from '@/domain/positions/positions.repository.interface';
import { ChainsRepositoryModule } from '@/domain/chains/chains.repository.interface';

@Module({
  imports: [PositionsRepositoryModule, ChainsRepositoryModule],
  controllers: [PositionsController],
  providers: [PositionsService],
})
export class PositionsModule {}
