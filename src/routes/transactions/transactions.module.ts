import { Module } from '@nestjs/common';
import { AddressInfoHelper } from '../common/address-info/address-info.helper';
import { MultisigTransactionMapper } from './mappers/multisig-transaction.mapper';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  providers: [
    AddressInfoHelper,
    MultisigTransactionMapper,
    TransactionsService,
  ],
})
export class TransactionsModule {}
