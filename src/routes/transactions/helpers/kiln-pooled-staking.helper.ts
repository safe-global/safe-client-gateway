import {
  BlockchainApiManagerModule,
  IBlockchainApiManager,
} from '@/domain/interfaces/blockchain-api.manager.interface';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';
import {
  ITokenRepository,
  TokenRepositoryModule,
} from '@/domain/tokens/token.repository.interface';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  TransactionFinder,
  TransactionFinderModule,
} from '@/routes/transactions/helpers/transaction-finder.helper';
import { Inject, Injectable, Module } from '@nestjs/common';
import { parseAbi, toFunctionSelector } from 'viem';

@Injectable()
export class KilnPooledStakingHelper {
  private static readonly TOKEN_DEFAULT_DECIMALS = 18;

  constructor(
    private readonly transactionFinder: TransactionFinder,
    @Inject(IBlockchainApiManager)
    private readonly blockchainApiManager: IBlockchainApiManager,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
  ) {}

  public async findStake(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
  }): Promise<{
    to: `0x${string}`;
    data: `0x${string}`;
  } | null> {
    const selector = toFunctionSelector('function stake() external payable');
    const transaction = this.transactionFinder.findTransaction(
      (transaction) => transaction.data.startsWith(selector),
      args,
    );

    if (!transaction?.to) {
      return null;
    }

    const deployment = await this.stakingRepository
      .getDeployment({
        chainId: args.chainId,
        address: transaction.to,
      })
      .catch(() => null);

    if (
      deployment?.product_type !== 'pooling' ||
      deployment?.chain === 'unknown'
    ) {
      return null;
    }

    return {
      to: transaction.to,
      data: transaction.data,
    };
  }

  public async findRequestExit(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
  }): Promise<{
    to: `0x${string}`;
    data: `0x${string}`;
  } | null> {
    const selector = toFunctionSelector(
      'function requestExit(uint256 amount) external',
    );
    const transaction = this.transactionFinder.findTransaction(
      (transaction) => transaction.data.startsWith(selector),
      args,
    );

    if (!transaction?.to) {
      return null;
    }

    const deployment = await this.stakingRepository
      .getDeployment({
        chainId: args.chainId,
        address: transaction.to,
      })
      .catch(() => null);

    if (
      deployment?.product_type !== 'pooling' ||
      deployment?.chain === 'unknown'
    ) {
      return null;
    }

    return {
      to: transaction.to,
      data: transaction.data,
    };
  }

  public async findMultiClaim(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
  }): Promise<{
    to: `0x${string}`;
    data: `0x${string}`;
  } | null> {
    const selector = toFunctionSelector(
      'function multiClaim(address[] exitQueues, uint256[][] ticketIds, uint32[][] casksIds) external',
    );
    const transaction = this.transactionFinder.findTransaction(
      (transaction) => transaction.data.startsWith(selector),
      args,
    );

    if (!transaction?.to) {
      return null;
    }

    const deployment = await this.stakingRepository
      .getDeployment({
        chainId: args.chainId,
        address: transaction.to,
      })
      .catch(() => null);

    if (deployment?.product_type !== 'pooling') {
      return null;
    }

    return {
      to: transaction.to,
      data: transaction.data,
    };
  }

  public async getRate(args: {
    chainId: string;
    pool: `0x${string}`;
  }): Promise<bigint> {
    const blockchainApi = await this.blockchainApiManager.getApi(args.chainId);
    // TODO: Should we cache this?
    return blockchainApi.readContract({
      abi: parseAbi(['function rate() external view returns (uint256)']),
      functionName: 'rate',
      address: args.pool,
    });
  }

  public async getPoolToken(args: {
    chainId: string;
    pool: `0x${string}`;
  }): Promise<TokenInfo> {
    const poolToken = await this.tokenRepository.getToken({
      chainId: args.chainId,
      address: args.pool,
    });

    return new TokenInfo({
      address: poolToken.address,
      decimals:
        poolToken.decimals ?? KilnPooledStakingHelper.TOKEN_DEFAULT_DECIMALS,
      logoUri: poolToken.logoUri,
      name: poolToken.name,
      symbol: poolToken.symbol,
      trusted: poolToken.trusted,
    });
  }
}

@Module({
  imports: [
    TransactionFinderModule,
    BlockchainApiManagerModule,
    TokenRepositoryModule,
    StakingRepositoryModule,
  ],
  providers: [KilnPooledStakingHelper],
  exports: [KilnPooledStakingHelper],
})
export class PooledStakingHelperModule {}
