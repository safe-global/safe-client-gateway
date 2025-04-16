import { Module } from '@nestjs/common';
import { DataDecodedApiModule } from '@/datasources/data-decoder-api/data-decoder-api.module';
import { DataDecoderRepository } from '@/domain/data-decoder/v2/data-decoder.repository';
import { IDataDecoderRepository } from '@/domain/data-decoder/v2/data-decoder.repository.interface';

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
