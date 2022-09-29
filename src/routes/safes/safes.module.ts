import { Module } from '@nestjs/common';
import { SafesController } from './safes.controller';
import { SafesService } from './safes.service';
import { AddressInfoModule } from '../common/address-info/address-info.module';

@Module({
  controllers: [SafesController],
  providers: [SafesService],
  imports: [AddressInfoModule],
})
export class SafesModule {}
