import { groupBy } from 'lodash';
import { Inject, Injectable } from '@nestjs/common';
import { IPositionsRepository } from '@/domain/positions/positions.repository.interface';
import { Position as DomainPosition } from '@/domain/positions/entities/position.entity';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { NativeCurrency } from '@/domain/chains/entities/native.currency.entity';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { getNumberString } from '@/domain/common/utils/utils';
import { Protocols } from '@/routes/positions/entities/protocols.entity';
import { Position } from '@/routes/positions/entities/position.entity';
import { PositionGroup } from '@/routes/positions/entities/position-group.entity';

interface PositionEntry extends Position {
  protocol: string | null;
  name: string;
}

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
  }): Promise<Array<Protocols>> {
    const { chainId } = args;
    const chain = await this.chainsRepository.getChain(chainId);
    const domainPositions = await this.positionsRepository.getPositions({
      ...args,
      chain,
    });
    const positions = domainPositions.map((position) =>
      this._mapPosition(position, chain.nativeCurrency),
    );

    const protocolGroups = this._groupByProtocol(positions);

    return Object.entries(protocolGroups).map(([protocol, positions]) =>
      this._mapProtocol(protocol, positions),
    );
  }

  private _groupByProtocol(
    positions: Array<PositionEntry>,
  ): Record<string, Array<PositionEntry>> {
    return groupBy(positions, (position) => position.protocol ?? 'unknown');
  }

  private _mapProtocol(
    protocol: string,
    positions: Array<PositionEntry>,
  ): Protocols {
    const nameGroups = this._groupByName(positions);
    const positionGroups = Object.entries(nameGroups).map(([name, group]) =>
      this._mapPositionGroup(name, group),
    );
    const fiatTotal = positionGroups.reduce(
      (acc, group) => acc + this._sumFiatBalances(group.items),
      0,
    );
    return {
      protocol,
      fiatTotal: getNumberString(fiatTotal),
      items: positionGroups,
    };
  }

  private _groupByName(
    positions: Array<PositionEntry>,
  ): Record<string, Array<PositionEntry>> {
    return groupBy(positions, (position) => position.name);
  }

  private _mapPositionGroup(
    name: string,
    positions: Array<PositionEntry>,
  ): PositionGroup {
    return { name, items: this._aggregateByType(positions) };
  }

  private _aggregateByType(positions: Array<PositionEntry>): Array<Position> {
    const typeGroups = groupBy(
      positions,
      (position) => position.position_type ?? 'unknown',
    );
    return Object.values(typeGroups).map((group) =>
      this._mapAggregatedPosition(group),
    );
  }

  private _mapAggregatedPosition(group: Array<PositionEntry>): Position {
    const [first] = group;
    const balance = group.reduce((sum, item) => sum + Number(item.balance), 0);
    const fiatBalance = group.reduce(
      (sum, item) => sum + Number(item.fiatBalance),
      0,
    );
    return {
      position_type: first.position_type,
      tokenInfo: first.tokenInfo,
      balance: getNumberString(balance),
      fiatBalance: getNumberString(fiatBalance),
      fiatBalance24hChange: first.fiatBalance24hChange,
      fiatConversion: first.fiatConversion,
    };
  }

  private _sumFiatBalances(items: Array<Position>): number {
    return items.reduce((sum, item) => sum + Number(item.fiatBalance), 0);
  }

  private _mapPosition(
    position: DomainPosition,
    nativeCurrency: NativeCurrency,
  ): PositionEntry {
    const tokenAddress = position.tokenAddress;
    const tokenType = tokenAddress === null ? 'NATIVE_TOKEN' : 'ERC20';

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
