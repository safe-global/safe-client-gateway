import { Module } from '@nestjs/common';
import { DataDecodedController } from '@/routes/data-decode/data-decoded.controller';
import { DataDecodedService } from '@/routes/data-decode/data-decoded.service';
import { DataDecoderRepositoryModule } from '@/domain/data-decoder/v2/data-decoder.repository.module';

@Module({
  imports: [DataDecoderRepositoryModule],
  controllers: [DataDecodedController],
  providers: [DataDecodedService],
})
export class DataDecodedModule {}
