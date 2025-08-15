import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IPositionsApi } from '@/domain/interfaces/positions-api.interface';
import { ZerionPositionsApi } from '@/datasources/positions-api/zerion-positions-api.service';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: IPositionsApi, useClass: ZerionPositionsApi },
  ],
  exports: [IPositionsApi],
})
export class PositionsApiModule {}
