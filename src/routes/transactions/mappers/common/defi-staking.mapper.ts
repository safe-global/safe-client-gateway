import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';
import {
  ITokenRepository,
  TokenRepositoryModule,
} from '@/domain/tokens/token.repository.interface';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  DefiDepositTransactionInfo,
  DefiStakingWithdrawTransactionInfo,
} from '@/routes/transactions/entities/staking/defi-staking-info.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  KilnDefiStakingHelper,
  KilnDefiStakingHelperModule,
} from '@/routes/transactions/helpers/kiln-defi-staking.helper';
import { Inject, Injectable, Module, NotFoundException } from '@nestjs/common';

@Injectable()
export class DefiStakingMapper {
  constructor(
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
    private readonly defiStakingHelper: KilnDefiStakingHelper,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
  ) {}

  public async mapDepositInfo(args: {
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
  }): Promise<DefiDepositTransactionInfo> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

    if (deployment.product_type !== 'defi' || deployment.chain === 'unknown') {
      throw new NotFoundException('DeFi vault not found');
    }

    const defiVaultStats = await this.stakingRepository.getDefiVaultStats({
      chainId: args.chainId,
      vault: args.to,
    });

    if (
      defiVaultStats.protocol === 'unknown' ||
      defiVaultStats.chain === 'unknown'
    ) {
      throw new NotFoundException('DeFi vault stats not found');
    }

    const [amount] = this.defiStakingHelper.decodeDeposit(args.data);
    const [exchangeRate, vaultToken] = await Promise.all([
      this.defiStakingHelper.previewDeposit({
        chainId: args.chainId,
        vault: args.to,
        amount,
      }),
      this.tokenRepository.getToken({
        chainId: args.chainId,
        address: args.to,
      }),
    ]);

    return new DefiDepositTransactionInfo({
      fee: 0, // TODO
      monthlyNrr: defiVaultStats.nrr,
      annualNrr: defiVaultStats.nrr,
      vault: new AddressInfo(args.to, deployment.display_name),
      exchangeRate: exchangeRate.toString(),
      vaultToken: new TokenInfo({
        address: vaultToken.address,
        decimals: vaultToken.decimals ?? defiVaultStats.asset_decimals,
        logoUri: vaultToken.logoUri,
        name: vaultToken.name,
        symbol: vaultToken.symbol,
        trusted: vaultToken.trusted,
      }),
    });
  }

  public async mapWithdrawInfo(args: {
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
  }): Promise<DefiStakingWithdrawTransactionInfo> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

    if (deployment.product_type !== 'defi' || deployment.chain === 'unknown') {
      throw new NotFoundException('DeFi vault not found');
    }

    const defiVaultStats = await this.stakingRepository.getDefiVaultStats({
      chainId: args.chainId,
      vault: args.to,
    });

    if (
      defiVaultStats.protocol === 'unknown' ||
      defiVaultStats.chain === 'unknown'
    ) {
      throw new NotFoundException('DeFi vault stats not found');
    }

    const [amount] = this.defiStakingHelper.decodeWithdraw(args.data);
    const [exchangeRate, vaultToken] = await Promise.all([
      this.defiStakingHelper.previewWithdraw({
        chainId: args.chainId,
        vault: args.to,
        amount,
      }),
      this.tokenRepository.getToken({
        chainId: args.chainId,
        address: args.to,
      }),
    ]);

    return new DefiStakingWithdrawTransactionInfo({
      vault: new AddressInfo(args.to, deployment.display_name),
      exchangeRate: exchangeRate.toString(),
      vaultToken: new TokenInfo({
        address: vaultToken.address,
        decimals: vaultToken.decimals ?? defiVaultStats.asset_decimals,
        logoUri: vaultToken.logoUri,
        name: vaultToken.name,
        symbol: vaultToken.symbol,
        trusted: vaultToken.trusted,
      }),
    });
  }
}

@Module({
  imports: [
    StakingRepositoryModule,
    KilnDefiStakingHelperModule,
    TokenRepositoryModule,
  ],
  providers: [DefiStakingMapper],
  exports: [DefiStakingMapper],
})
export class DefiStakingMapperModule {}
