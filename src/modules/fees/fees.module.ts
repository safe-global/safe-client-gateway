// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { FeeServiceApiModule } from '@/datasources/fee-service-api/fee-service-api.module';
import { FeesController } from '@/modules/fees/routes/fees.controller';
import { FeesService } from '@/modules/fees/routes/fees.service';

@Module({
  imports: [FeeServiceApiModule],
  controllers: [FeesController],
  providers: [FeesService],
})
export class FeesModule {}
