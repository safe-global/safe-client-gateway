import { Module } from '@nestjs/common';
import { AddressInfoModule } from '../common/address-info/address-info.module';
import { MultisigTransactionInfoMapper } from './mappers/multisig-transactions/multisig-transaction-info.mapper';
import { MultisigTransactionStatusMapper } from './mappers/multisig-transactions/multisig-transaction-status.mapper';
import { MultisigTransactionMapper } from './mappers/multisig-transactions/multisig-transaction.mapper';
import { SettingsChangeMapper } from './mappers/multisig-transactions/settings-change.mapper';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  imports: [AddressInfoModule],
  providers: [
    MultisigTransactionInfoMapper,
    MultisigTransactionMapper,
    MultisigTransactionStatusMapper,
    SettingsChangeMapper,
    TransactionsService,
  ],
})
export class TransactionsModule {}
