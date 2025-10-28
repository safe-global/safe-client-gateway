import { Module } from '@nestjs/common';
import { LimitAddressesMapper } from '@/domain/relay/limit-addresses.mapper';
import { RelayRepository } from '@/domain/relay/relay.repository';
import { RelayApiModule } from '@/datasources/relay-api/relay-api.module';
import { RelayDecodersModule } from '@/domain/relay/relay-decoders.module';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/decoders/delay-modifier-decoder.helper';
import { BalancesModule } from '@/routes/balances/balances.module';
import { DailyLimitRelayer } from '@/domain/relay/relayers/daily-limit.relayer';
import { NoFeeCampaignRelayer } from '@/domain/relay/relayers/no-fee-campaign.relayer';
import { RelayManager } from '@/domain/relay/relay.manager';
import { IRelayManager } from '@/domain/relay/interfaces/relay-manager.interface';

@Module({
  imports: [
    RelayApiModule,
    RelayDecodersModule,
    SafeRepositoryModule,
    BalancesModule,
  ],
  providers: [
    LimitAddressesMapper,
    RelayRepository,
    DelayModifierDecoder,
    DailyLimitRelayer,
    NoFeeCampaignRelayer,
    {
      provide: IRelayManager,
      useClass: RelayManager,
    },
  ],
  exports: [RelayRepository],
})
export class RelayDomainModule {}
