import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IPositionsApi } from '@/domain/interfaces/positions-api.interface';
import { ZerionPositionsApi } from '@/modules/positions/datasources/zerion-positions-api.service';
import { PositionsRepository } from '@/modules/positions/domain/positions.repository';
import { IPositionsRepository } from '@/modules/positions/domain/positions.repository.interface';
import { PositionsController } from '@/modules/positions/routes/positions.controller';
import { PositionsService } from '@/modules/positions/routes/positions.service';
import { ChainsModule } from '@/modules/chains/chains.module';

@Module({
  imports: [CacheFirstDataSourceModule, ChainsModule],
  controllers: [PositionsController],
  providers: [
    HttpErrorFactory,
    { provide: IPositionsApi, useClass: ZerionPositionsApi },
    {
      provide: IPositionsRepository,
      useClass: PositionsRepository,
    },
    PositionsService,
  ],
  exports: [IPositionsApi, IPositionsRepository],
})
export class PositionsModule {}
