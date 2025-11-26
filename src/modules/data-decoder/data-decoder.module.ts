import { Module } from '@nestjs/common';
import { DataDecodedApiModule } from '@/modules/data-decoder/datasources/data-decoder-api.module';
import { DataDecoderRepositoryModule } from '@/modules/data-decoder/domain/v2/data-decoder.repository.module';
import { DataDecodedRepositoryModule } from '@/modules/data-decoder/domain/v1/data-decoded.repository.interface';
import { DataDecodedModule as DataDecodedRoutesModule } from '@/modules/data-decoder/routes/data-decoded.module';

@Module({
  imports: [
    DataDecodedApiModule,
    DataDecoderRepositoryModule,
    DataDecodedRepositoryModule,
    DataDecodedRoutesModule,
  ],
})
export class DataDecoderModule {}
