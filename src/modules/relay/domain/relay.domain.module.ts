// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { FeeServiceApiModule } from '@/datasources/fee-service-api/fee-service-api.module';
import { BalancesModule } from '@/modules/balances/balances.module';
import { ChainsModule } from '@/modules/chains/chains.module';
import { RelayApiModule } from '@/modules/relay/datasources/relay-api.module';
import { TenderlySimulationApiModule } from '@/modules/relay/datasources/tenderly-simulation-api.module';
import { IRelayManager } from '@/modules/relay/domain/interfaces/relay-manager.interface';
import { LimitAddressesMapper } from '@/modules/relay/domain/limit-addresses.mapper';
import { RelayManager } from '@/modules/relay/domain/relay.manager';
import { RelayRepository } from '@/modules/relay/domain/relay.repository';
import { RelayDecodersModule } from '@/modules/relay/domain/relay-decoders.module';
import { RelaySimulationService } from '@/modules/relay/domain/relay-simulation.service';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import { DailyLimitRelayer } from '@/modules/relay/domain/relayers/daily-limit.relayer';
import { NoFeeCampaignRelayer } from '@/modules/relay/domain/relayers/no-fee-campaign.relayer';
import { RelayFeeRelayer } from '@/modules/relay/domain/relayers/relay-fee.relayer';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';

@Module({
  imports: [
    RelayApiModule,
    RelayDecodersModule,
    SafeRepositoryModule,
    BalancesModule,
    ChainsModule,
    FeeServiceApiModule,
    TenderlySimulationApiModule,
  ],
  providers: [
    RelayTransactionHelper,
    LimitAddressesMapper,
    RelaySimulationService,
    RelayRepository,
    DailyLimitRelayer,
    NoFeeCampaignRelayer,
    RelayFeeRelayer,
    {
      provide: IRelayManager,
      useClass: RelayManager,
    },
  ],
  // The mapper and the simulation gate are what a relayer outside this module
  // — `WorkspaceRelayer`, wired under its own feature flags — reuses instead
  // of restating.
  exports: [RelayRepository, LimitAddressesMapper, RelaySimulationService],
})
export class RelayDomainModule {}
