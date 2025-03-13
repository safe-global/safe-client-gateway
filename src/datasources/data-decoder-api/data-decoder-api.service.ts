import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { DataDecoded } from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import type { Contract } from '@/domain/data-decoder/v2/entities/contract.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
import type { Raw } from '@/validation/entities/raw.entity';

export class DataDecoderApi implements IDataDecoderApi {
  constructor(
    private readonly chainId: string,
    private readonly baseUrl: string,
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {}

  public async getDecodedData(args: {
    data: `0x${string}`;
    to: `0x${string}`;
  }): Promise<Raw<DataDecoded>> {
    try {
      const url = `${this.baseUrl}/api/v1/data-decoder`;
      const { data: dataDecoded } = await this.networkService.post<DataDecoded>(
        {
          url,
          data: {
            chainId: Number(this.chainId),
            to: args.to,
            data: args.data,
          },
        },
      );
      return dataDecoded;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  public async getContracts(args: {
    address: `0x${string}`;
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
              chain_ids: Number(this.chainId),
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
