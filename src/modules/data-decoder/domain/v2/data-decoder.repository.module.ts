import { Module } from '@nestjs/common';
import { DataDecodedApiModule } from '@/modules/data-decoder/datasources/data-decoder-api.module';
import { DataDecoderRepository } from '@/modules/data-decoder/domain/v2/data-decoder.repository';
import { IDataDecoderRepository } from '@/modules/data-decoder/domain/v2/data-decoder.repository.interface';

@Module({
  imports: [DataDecodedApiModule],
  providers: [
    {
      provide: IDataDecoderRepository,
      useClass: DataDecoderRepository,
    },
  ],
  exports: [IDataDecoderRepository],
})
export class DataDecoderRepositoryModule {}
