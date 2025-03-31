import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  NetworkService,
  type INetworkService,
} from '@/datasources/network/network.service.interface';
import type { DataDecoded } from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import type { Contract } from '@/domain/data-decoder/v2/entities/contract.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
import type { Raw } from '@/validation/entities/raw.entity';
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class DataDecoderApi implements IDataDecoderApi {
  private readonly baseUrl: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUrl = this.configurationService.getOrThrow<string>(
      'safeDataDecoder.baseUri',
    );
  }

  public async getDecodedData(args: {
    data: `0x${string}`;
    to: `0x${string}`;
    chainId: string;
  }): Promise<Raw<DataDecoded>> {
    try {
      const url = `${this.baseUrl}/api/v1/data-decoder`;
      const { data: dataDecoded } = await this.networkService.post<DataDecoded>(
        {
          url,
          data: args,
        },
      );
      return dataDecoded;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  public async getContracts(args: {
    address: `0x${string}`;
    chainIds: Array<string>;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Contract>>> {
    try {
      const url = `${this.baseUrl}/api/v1/contracts/${args.address}`;
      const { data: contracts } = await this.networkService.get<Page<Contract>>(
        {
          url,
          networkRequest: {
            params: {
              chain_ids: args.chainIds.join('&chain_ids='),
              limit: args.limit,
              offset: args.offset,
            },
          },
        },
      );
      return contracts;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
