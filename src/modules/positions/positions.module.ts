import { Module } from '@nestjs/common';
import { PositionsApiModule } from '@/modules/positions/datasources/positions-api.module';
import { PositionsRepositoryModule } from '@/modules/positions/domain/positions.repository.interface';
import { PositionsModule as PositionsRoutesModule } from '@/modules/positions/routes/positions.module';

@Module({
  imports: [
    PositionsApiModule,
    PositionsRepositoryModule,
    PositionsRoutesModule,
  ],
})
export class PositionsModule {}
