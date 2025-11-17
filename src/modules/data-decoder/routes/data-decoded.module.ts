import { Module } from '@nestjs/common';
import { DataDecodedController } from '@/modules/data-decoder/routes/data-decoded.controller';
import { DataDecodedService } from '@/modules/data-decoder/routes/data-decoded.service';
import { DataDecoderRepositoryModule } from '@/modules/data-decoder/domain/v2/data-decoder.repository.module';

@Module({
  imports: [DataDecoderRepositoryModule],
  controllers: [DataDecodedController],
  providers: [DataDecodedService],
  exports: [DataDecodedService],
})
export class DataDecodedModule {}
