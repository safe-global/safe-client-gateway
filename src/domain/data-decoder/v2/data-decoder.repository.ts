import { Inject, Injectable } from '@nestjs/common';
import {
  DataDecoded,
  DataDecodedSchema,
} from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import { IDataDecoderRepository } from '@/domain/data-decoder/v2/data-decoder.repository.interface';
import { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
import { Page } from '@/domain/entities/page.entity';
import {
  Contract,
  ContractPageSchema,
} from '@/domain/data-decoder/v2/entities/contract.entity';

@Injectable()
export class DataDecoderRepository implements IDataDecoderRepository {
  constructor(
    @Inject(IDataDecoderApi)
    private readonly dataDecoderApi: IDataDecoderApi,
  ) {}

  public async getDecodedData(args: {
    chainId: string;
    data: `0x${string}`;
    to: `0x${string}`;
  }): Promise<DataDecoded> {
    const dataDecoded = await this.dataDecoderApi.getDecodedData(args);
    return DataDecodedSchema.parse(dataDecoded);
  }

  public async getContracts(args: {
    chainIds: Array<string>;
    address: `0x${string}`;
  }): Promise<Page<Contract>> {
    const contracts = await this.dataDecoderApi.getContracts(args);
    return ContractPageSchema.parse(contracts);
  }
}
