import { Module } from '@nestjs/common';
import { DataDecoderApiManagerModule } from '@/datasources/data-decoder-api/data-decoder-api.manager.module';
import { DataDecoderRepository } from '@/domain/data-decoder/v2/data-decoder.repository';
import { IDataDecoderRepository } from '@/domain/data-decoder/v2/data-decoder.repository.interface';

@Module({
  imports: [DataDecoderApiManagerModule],
  providers: [
    {
      provide: IDataDecoderRepository,
      useClass: DataDecoderRepository,
    },
  ],
  exports: [IDataDecoderRepository],
})
export class DataDecoderRepositoryModule {}
