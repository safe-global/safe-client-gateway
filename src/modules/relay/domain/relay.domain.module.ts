// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { FeeServiceApiModule } from '@/datasources/fee-service-api/fee-service-api.module';
import { DelayModifierDecoder } from '@/modules/alerts/domain/contracts/decoders/delay-modifier-decoder.helper';
import { BalancesModule } from '@/modules/balances/balances.module';
import { RelayApiModule } from '@/modules/relay/datasources/relay-api.module';
import { IRelayManager } from '@/modules/relay/domain/interfaces/relay-manager.interface';
import { LimitAddressesMapper } from '@/modules/relay/domain/limit-addresses.mapper';
import { RelayManager } from '@/modules/relay/domain/relay.manager';
import { RelayRepository } from '@/modules/relay/domain/relay.repository';
import { RelayDecodersModule } from '@/modules/relay/domain/relay-decoders.module';
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
    FeeServiceApiModule,
  ],
  providers: [
    LimitAddressesMapper,
    RelayRepository,
    DelayModifierDecoder,
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
