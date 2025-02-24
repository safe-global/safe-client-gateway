import { Inject, Injectable } from '@nestjs/common';
import {
  DataDecoded,
  DataDecodedSchema,
} from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import { IDataDecoderRepository } from '@/domain/data-decoder/v2/data-decoder.repository.interface';
import { IDataDecoderApiManager } from '@/domain/interfaces/data-decoder-api.manager.interface';
import { Page } from '@/domain/entities/page.entity';
import {
  Contract,
  ContractPageSchema,
} from '@/domain/data-decoder/v2/entities/contract.entity';

@Injectable()
export class DataDecoderRepository implements IDataDecoderRepository {
  constructor(
    @Inject(IDataDecoderApiManager)
    private readonly dataDecoderApiManager: IDataDecoderApiManager,
  ) {}

  public async getDecodedData(args: {
    chainId: string;
    data: `0x${string}`;
    to: `0x${string}`;
  }): Promise<DataDecoded> {
    const api = await this.dataDecoderApiManager.getApi(args.chainId);
    const dataDecoded = await api.getDecodedData(args);
    return DataDecodedSchema.parse(dataDecoded);
  }

  public async getContracts(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<Page<Contract>> {
    const api = await this.dataDecoderApiManager.getApi(args.chainId);
    const contracts = await api.getContracts(args);
    return ContractPageSchema.parse(contracts);
  }
}
