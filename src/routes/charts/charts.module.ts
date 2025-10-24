import { Module } from '@nestjs/common';
import { ChartsController } from '@/routes/charts/charts.controller';
import { ChartsService } from '@/routes/charts/charts.service';
import { ChartsRepositoryModule } from '@/domain/charts/charts.repository.module';

@Module({
  imports: [ChartsRepositoryModule],
  controllers: [ChartsController],
  providers: [ChartsService],
})
export class ChartsModule {}
