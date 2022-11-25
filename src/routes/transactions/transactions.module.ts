import { Module } from '@nestjs/common';
import { AddressInfoHelper } from '../common/address-info/address-info.helper';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, AddressInfoHelper],
})
export class TransactionsModule {}
