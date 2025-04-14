import { Module } from '@nestjs/common';
import { DataDecoderApi } from '@/datasources/data-decoder-api/data-decoder-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';

@Module({
  providers: [
    HttpErrorFactory,
    { provide: IDataDecoderApi, useClass: DataDecoderApi },
  ],
  exports: [IDataDecoderApi],
})
export class DataDecodedApiModule {}
