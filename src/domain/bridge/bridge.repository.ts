import { Inject, Injectable } from '@nestjs/common';
import { IBridgeRepository } from '@/domain/bridge/bridge.repository.interface';
import {
  BridgeStatus,
  BridgeStatusSchema,
} from '@/domain/bridge/entities/bridge-status.entity';
import { IBridgeApiFactory } from '@/domain/interfaces/bridge-api.factory.interface';
import {
  BridgeCalldata,
  BridgeCalldataSchema,
} from '@/domain/bridge/entities/bridge-calldata.entity';
import { BridgeName } from '@/domain/bridge/entities/bridge-name.entity';

@Injectable()
export class BridgeRepository implements IBridgeRepository {
  constructor(
    @Inject(IBridgeApiFactory)
    private readonly bridgeApiFactory: IBridgeApiFactory,
  ) {}

  async getStatus(args: {
    chainId: string;
    txHash: `0x${string}`;
    bridge?: BridgeName;
    toChainId?: string;
  }): Promise<BridgeStatus> {
    const api = await this.bridgeApiFactory.getApi(args.chainId);
    const status = await api.getStatus(args);
    return BridgeStatusSchema.parse(status);
  }

  async parseCalldata(args: {
    chainId: string;
    data: `0x${string}`;
  }): Promise<BridgeCalldata> {
    const api = await this.bridgeApiFactory.getApi(args.chainId);
    const calldata = await api.parseCalldata(args.data);
    return BridgeCalldataSchema.parse(calldata);
  }
}
