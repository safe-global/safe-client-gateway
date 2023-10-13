import { Module } from '@nestjs/common';
import { AddressInfoModule } from '@/routes/common/address-info/address-info.module';
import { SafesController } from '@/routes/safes/safes.controller';
import { SafesService } from '@/routes/safes/safes.service';

@Module({
  controllers: [SafesController],
  providers: [SafesService],
  imports: [AddressInfoModule],
})
export class SafesModule {}
