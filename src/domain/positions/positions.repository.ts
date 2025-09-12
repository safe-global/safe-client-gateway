import { Inject, Injectable } from '@nestjs/common';
import { IPositionsRepository } from '@/domain/positions/positions.repository.interface';
import { IPositionsApi } from '@/domain/interfaces/positions-api.interface';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { z } from 'zod';
import {
  Position,
  PositionsSchema,
} from '@/domain/positions/entities/position.entity';
import type { Address } from 'viem';

@Injectable()
export class PositionsRepository implements IPositionsRepository {
  constructor(
    @Inject(IPositionsApi) private readonly positionsApi: IPositionsApi,
  ) {}

  async getPositions(args: {
    chain: Chain;
    safeAddress: Address;
    fiatCode: string;
    refresh?: string;
  }): Promise<Array<Position>> {
    const positions = await this.positionsApi.getPositions(args);
    return PositionsSchema.parse(positions);
  }

  async clearPositions(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    await this.positionsApi.clearPositions(args);
  }

  async getFiatCodes(): Promise<Array<string>> {
    return this.positionsApi.getFiatCodes().then(z.array(z.string()).parse);
  }
}
