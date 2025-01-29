import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { DataDecoderApi } from '@/datasources/data-decoder-api/data-decoder-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { IDataDecoderApiManager } from '@/domain/interfaces/data-decoder-api.manager.interface';

@Injectable()
export class DataDecoderApiManager implements IDataDecoderApiManager {
  private decoderApiMap: Record<string, DataDecoderApi> = {};

  private readonly baseUri: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
  ) {
    this.baseUri = this.configurationService.getOrThrow<string>(
      'safeDataDecoder.baseUri',
    );
  }

  async getApi(chainId: string): Promise<DataDecoderApi> {
    const decoderApi = this.decoderApiMap[chainId];

    if (decoderApi !== undefined) {
      return Promise.resolve(decoderApi);
    }

    this.decoderApiMap[chainId] = new DataDecoderApi(
      chainId,
      this.baseUri,
      this.networkService,
      this.httpErrorFactory,
    );

    return Promise.resolve(this.decoderApiMap[chainId]);
  }

  // We don't need to destroy the API as it is not event-specific
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  destroyApi(_: string): void {
    throw new Error('Method not implemented');
  }
}
