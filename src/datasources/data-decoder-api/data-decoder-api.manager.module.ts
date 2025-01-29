import { Module } from '@nestjs/common';
import { DataDecoderApiManager } from '@/datasources/data-decoder-api/data-decoder-api.manager';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IDataDecoderApiManager } from '@/domain/interfaces/data-decoder-api.manager.interface';

@Module({
  providers: [
    {
      provide: IDataDecoderApiManager,
      useClass: DataDecoderApiManager,
    },
    HttpErrorFactory,
  ],
  exports: [IDataDecoderApiManager],
})
export class DataDecoderApiManagerModule {}
