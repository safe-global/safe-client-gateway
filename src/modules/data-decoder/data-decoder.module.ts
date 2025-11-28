import { Module } from '@nestjs/common';
import { DataDecoderApi } from '@/modules/data-decoder/datasources/data-decoder-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { DataDecoderRepository } from '@/modules/data-decoder/domain/v2/data-decoder.repository';
import { IDataDecoderRepository } from '@/modules/data-decoder/domain/v2/data-decoder.repository.interface';
import { DataDecodedRepository } from '@/modules/data-decoder/domain/v1/data-decoded.repository';
import { IDataDecodedRepository } from '@/modules/data-decoder/domain/v1/data-decoded.repository.interface';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { DataDecodedController } from '@/modules/data-decoder/routes/data-decoded.controller';
import { DataDecodedService } from '@/modules/data-decoder/routes/data-decoded.service';

@Module({
  imports: [CacheFirstDataSourceModule, TransactionApiManagerModule],
  controllers: [DataDecodedController],
  providers: [
    HttpErrorFactory,
    { provide: IDataDecoderApi, useClass: DataDecoderApi },
    {
      provide: IDataDecoderRepository,
      useClass: DataDecoderRepository,
    },
    {
      provide: IDataDecodedRepository,
      useClass: DataDecodedRepository,
    },
    DataDecodedService,
  ],
  exports: [
    IDataDecoderApi,
    IDataDecoderRepository,
    IDataDecodedRepository,
    DataDecodedService,
  ],
})
export class DataDecoderModule {}
