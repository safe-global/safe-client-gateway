import { Module } from '@nestjs/common';
import { DataDecodedController } from '@/routes/data-decode/data-decoded.controller';
import { DataDecodedService } from '@/routes/data-decode/data-decoded.service';
import { DataDecodedRepositoryModule } from '@/domain/data-decoder/data-decoded.repository.interface';

@Module({
  imports: [DataDecodedRepositoryModule],
  controllers: [DataDecodedController],
  providers: [DataDecodedService],
})
export class DataDecodedModule {}
