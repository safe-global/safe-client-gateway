import { Module } from '@nestjs/common';
import { DataDecoderApi } from '@/datasources/data-decoder-api/data-decoder-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: IDataDecoderApi, useClass: DataDecoderApi },
  ],
  exports: [IDataDecoderApi],
})
export class DataDecodedApiModule {}
