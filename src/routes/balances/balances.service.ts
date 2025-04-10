import { Inject, Injectable } from '@nestjs/common';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import { Balance as DomainBalance } from '@/domain/balances/entities/balance.entity';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { NativeCurrency } from '@/domain/chains/entities/native.currency.entity';
import { Balance } from '@/routes/balances/entities/balance.entity';
import { Balances } from '@/routes/balances/entities/balances.entity';
import {
  NativeToken,
  Erc20Token,
} from '@/routes/balances/entities/token.entity';
import { NULL_ADDRESS } from '@/routes/common/constants';
import orderBy from 'lodash/orderBy';
import { getNumberString } from '@/domain/common/utils/utils';

@Injectable()
export class BalancesService {
  constructor(
    @Inject(IBalancesRepository)
    private readonly balancesRepository: IBalancesRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {}

  async getBalances(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    fiatCode: string;
    trusted: boolean;
    excludeSpam: boolean;
  }): Promise<Balances> {
    const { chainId } = args;
    const chain = await this.chainsRepository.getChain(chainId);
    const domainBalances = await this.balancesRepository.getBalances({
      ...args,
      chain,
    });
    const balances: Array<Balance> = domainBalances.map((balance) =>
      this._mapBalance(balance, chain.nativeCurrency),
    );
    const fiatTotal = balances
      .filter((b) => b.fiatBalance !== null)
      .reduce((acc, b) => acc + Number(b.fiatBalance), 0);

    return {
      fiatTotal: getNumberString(fiatTotal),
      items: orderBy(balances, (b) => Number(b.fiatBalance), 'desc'),
    };
  }

  private _mapBalance(
    balance: DomainBalance,
    nativeCurrency: NativeCurrency,
  ): Balance {
    const tokenAddress = balance.tokenAddress;
    const tokenType: (NativeToken | Erc20Token)['type'] =
      tokenAddress === null ? 'NATIVE_TOKEN' : 'ERC20';

    const tokenMetaData =
      tokenAddress === null
        ? {
            decimals: nativeCurrency.decimals,
            symbol: nativeCurrency.symbol,
            name: nativeCurrency.name,
            logoUri: nativeCurrency.logoUri,
          }
        : {
            decimals: balance.token.decimals,
            symbol: balance.token.symbol,
            name: balance.token.name,
            logoUri: balance.token.logoUri,
          };

    return {
      tokenInfo: {
        type: tokenType,
        address: tokenAddress ?? NULL_ADDRESS,
        ...tokenMetaData,
      },
      balance: balance.balance,
      fiatBalance: balance.fiatBalance ?? '0',
      fiatBalance24hChange: balance.fiatBalance24hChange,
      fiatConversion: balance.fiatConversion ?? '0',
    };
  }

  async getSupportedFiatCodes(): Promise<Array<string>> {
    return this.balancesRepository.getFiatCodes();
  }
}
