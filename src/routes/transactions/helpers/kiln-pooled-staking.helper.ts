import {
  BlockchainApiManagerModule,
  IBlockchainApiManager,
} from '@/domain/interfaces/blockchain-api.manager.interface';
import {
  ITokenRepository,
  TokenRepositoryModule,
} from '@/domain/tokens/token.repository.interface';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  TransactionDataFinder,
  TransactionDataFinderModule,
} from '@/routes/transactions/helpers/transaction-data-finder.helper';
import { Inject, Injectable, Module } from '@nestjs/common';
import { parseAbi, toFunctionSelector } from 'viem';

@Injectable()
export class KilnPooledStakingHelper {
  private static readonly TOKEN_DEFAULT_DECIMALS = 18;

  constructor(
    private readonly transactionDataFinder: TransactionDataFinder,
    @Inject(IBlockchainApiManager)
    private readonly blockchainApiManager: IBlockchainApiManager,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
  ) {}

  public findStake(data: `0x${string}`): `0x${string}` | null {
    const selector = toFunctionSelector('function stake() external payable');
    return this.transactionDataFinder.findTransactionData(
      (transaction) => transaction.data.startsWith(selector),
      { data },
    );
  }

  public findRequestExit(data: `0x${string}`): `0x${string}` | null {
    const selector = toFunctionSelector(
      'function requestExit(uint256 amount) external',
    );
    return this.transactionDataFinder.findTransactionData(
      (transaction) => transaction.data.startsWith(selector),
      { data },
    );
  }

  public findWithdraw(data: `0x${string}`): `0x${string}` | null {
    const selector = toFunctionSelector(
      'function multiClaim(address[] exitQueues, uint256[][] ticketIds, uint32[][] casksIds) external',
    );
    return this.transactionDataFinder.findTransactionData(
      (transaction) => transaction.data.startsWith(selector),
      { data },
    );
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
    TransactionDataFinderModule,
    BlockchainApiManagerModule,
    TokenRepositoryModule,
  ],
  providers: [KilnPooledStakingHelper],
  exports: [KilnPooledStakingHelper],
})
export class PooledStakingHelperModule {}
