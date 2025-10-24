import { Module } from '@nestjs/common';
import { ChartsRepository } from '@/domain/charts/charts.repository';
import { IChartsRepository } from '@/domain/charts/charts.repository.interface';
import { ChartsApiModule } from '@/datasources/charts-api/charts-api.module';

@Module({
  imports: [ChartsApiModule],
  providers: [
    {
      provide: IChartsRepository,
      useClass: ChartsRepository,
    },
  ],
  exports: [IChartsRepository],
})
export class ChartsRepositoryModule {}
