import { Inject, Injectable } from '@nestjs/common';
import { IPositionsRepository } from '@/domain/positions/positions.repository.interface';
import { Position as DomainPosition } from '@/domain/positions/entities/position.entity';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { NativeCurrency } from '@/domain/chains/entities/native.currency.entity';
import {
  NativeToken,
  Erc20Token,
} from '@/routes/balances/entities/token.entity';
import { NULL_ADDRESS } from '@/routes/common/constants';
import orderBy from 'lodash/orderBy';
import { getNumberString } from '@/domain/common/utils/utils';
import { Positions } from '@/routes/positions/entities/positions.entity';
import { Position } from '@/routes/positions/entities/position.entity';

@Injectable()
export class PositionsService {
  constructor(
    @Inject(IPositionsRepository)
    private readonly positionsRepository: IPositionsRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {}

  async getPositions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    fiatCode: string;
  }): Promise<Positions> {
    const { chainId } = args;
    const chain = await this.chainsRepository.getChain(chainId);
    const domainPositions = await this.positionsRepository.getPositions({
      ...args,
      chain,
    });
    const positions: Array<Position> = domainPositions.map((position) =>
      this._mapPosition(position, chain.nativeCurrency),
    );
    const fiatTotal = positions
      .filter((b) => b.fiatBalance !== null)
      .reduce((acc, b) => acc + Number(b.fiatBalance), 0);

    return {
      fiatTotal: getNumberString(fiatTotal),
      items: orderBy(positions, (b) => Number(b.fiatBalance), 'desc'),
    };
  }

  private _mapPosition(
    position: DomainPosition,
    nativeCurrency: NativeCurrency,
  ): Position {
    const tokenAddress = position.tokenAddress;
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
            decimals: position.token.decimals,
            symbol: position.token.symbol,
            name: position.token.name,
            logoUri: position.token.logoUri,
          };

    return {
      tokenInfo: {
        type: tokenType,
        address: tokenAddress ?? NULL_ADDRESS,
        ...tokenMetaData,
      },
      balance: position.balance,
      fiatBalance: position.fiatBalance ?? '0',
      fiatBalance24hChange: position.fiatBalance24hChange,
      fiatConversion: position.fiatConversion ?? '0',
      protocol: position.protocol,
      name: position.name,
      position_type: position.position_type,
    };
  }
}
