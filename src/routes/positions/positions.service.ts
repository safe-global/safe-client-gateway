import { groupBy } from 'lodash';
import { Inject, Injectable } from '@nestjs/common';
import { IPositionsRepository } from '@/domain/positions/positions.repository.interface';
import { Position as DomainPosition } from '@/domain/positions/entities/position.entity';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { NativeCurrency } from '@/domain/chains/entities/native.currency.entity';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { getNumberString } from '@/domain/common/utils/utils';
import { Protocol } from '@/routes/positions/entities/protocol.entity';
import { Position } from '@/routes/positions/entities/position.entity';
import { PositionGroup } from '@/routes/positions/entities/position-group.entity';
import { ZerionApplicationMetadataSchema } from '@/datasources/balances-api/entities/zerion-balance.entity';
import { z } from 'zod';
import { PositionType } from '@/domain/positions/entities/position-type.entity';
import type { Address } from 'viem';

interface PositionEntry extends Position {
  protocol: string | null;
  name: string;
  application_metadata: z.infer<typeof ZerionApplicationMetadataSchema>;
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
    safeAddress: Address;
    fiatCode: string;
    refresh?: boolean;
  }): Promise<Array<Protocol>> {
    const { chainId, refresh } = args;
    const chain = await this.chainsRepository.getChain(chainId);
    // Convert boolean refresh to timestamp string for cache busting
    const refreshKey = refresh ? Date.now().toString() : '';
    const domainPositions = await this.positionsRepository.getPositions({
      ...args,
      chain,
      refresh: refreshKey,
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
  ): Protocol {
    const nameGroups = this._groupByName(positions);
    const positionGroups = Object.entries(nameGroups).map(([name, group]) =>
      this._mapPositionGroup(name, group),
    );
    // Calculate fiat total from all individual positions
    const fiatTotal = positions.reduce((sum, position) => {
      const fiatBalance = Number(position.fiatBalance) || 0;
      const sign = position.position_type === PositionType.loan ? -1 : 1;
      return sum + sign * fiatBalance;
    }, 0);
    return {
      protocol,
      protocol_metadata: positions[0].application_metadata,
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
    const items = positions.map((position) => ({
      position_type: position.position_type,
      tokenInfo: position.tokenInfo,
      balance: position.balance,
      fiatBalance: position.fiatBalance,
      fiatBalance24hChange: position.fiatBalance24hChange,
      fiatConversion: position.fiatConversion,
    }));
    return { name, items };
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
      application_metadata: position.application_metadata,
    };
  }
}
