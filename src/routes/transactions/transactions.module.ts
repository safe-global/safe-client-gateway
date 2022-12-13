import { Module } from '@nestjs/common';
import { AddressInfoModule } from '../common/address-info/address-info.module';
import { MultisigTransactionMapper } from './mappers/multisig-transaction.mapper';
import { IncomingTransferMapper } from './mappers/transaction.mapper';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  imports: [AddressInfoModule],
  providers: [
    IncomingTransferMapper,
    MultisigTransactionMapper,
    TransactionsService,
  ],
})
export class TransactionsModule {}
