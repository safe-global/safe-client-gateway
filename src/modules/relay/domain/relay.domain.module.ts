// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { FeeServiceApiModule } from '@/datasources/fee-service-api/fee-service-api.module';
import { BalancesModule } from '@/modules/balances/balances.module';
import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { RelayApiModule } from '@/modules/relay/datasources/relay-api.module';
import { IRelayManager } from '@/modules/relay/domain/interfaces/relay-manager.interface';
import { LimitAddressesMapper } from '@/modules/relay/domain/limit-addresses.mapper';
import { RelayManager } from '@/modules/relay/domain/relay.manager';
import { RelayRepository } from '@/modules/relay/domain/relay.repository';
import { RelayDecodersModule } from '@/modules/relay/domain/relay-decoders.module';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import { DailyLimitRelayer } from '@/modules/relay/domain/relayers/daily-limit.relayer';
import { NoFeeCampaignRelayer } from '@/modules/relay/domain/relayers/no-fee-campaign.relayer';
import { RelayFeeRelayer } from '@/modules/relay/domain/relayers/relay-fee.relayer';
import { RelayClassifier } from '@/modules/relay/domain/validation/relay-classifier';
import { CreateProxyRule } from '@/modules/relay/domain/validation/rules/create-proxy.rule';
import { CreateSignerRule } from '@/modules/relay/domain/validation/rules/create-signer.rule';
import { ExecTransactionRule } from '@/modules/relay/domain/validation/rules/exec-transaction.rule';
import { MultiSendRule } from '@/modules/relay/domain/validation/rules/multi-send.rule';
import { RecoveryRule } from '@/modules/relay/domain/validation/rules/recovery.rule';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';

@Module({
  imports: [
    RelayApiModule,
    RelayDecodersModule,
    SafeRepositoryModule,
    BalancesModule,
    FeeServiceApiModule,
    BlockchainModule,
  ],
  providers: [
    RelayTransactionHelper,
    RecoveryRule,
    ExecTransactionRule,
    MultiSendRule,
    CreateProxyRule,
    CreateSignerRule,
    RelayClassifier,
    LimitAddressesMapper,
    RelayRepository,
    DailyLimitRelayer,
    NoFeeCampaignRelayer,
    RelayFeeRelayer,
    {
      provide: IRelayManager,
      useClass: RelayManager,
    },
  ],
  exports: [RelayRepository],
})
export class RelayDomainModule {}
