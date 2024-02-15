import { Inject, Injectable } from '@nestjs/common';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';

@Injectable()
export class GelatoApi implements IRelayApi {
  /**
   * If you are using your own custom gas limit, please add a 150k gas buffer on top of the expected
   * gas usage for the transaction. This is for the Gelato Relay execution overhead, and adding this
   * buffer reduces your chance of the task cancelling before it is executed on-chain.
   * @see https://docs.gelato.network/developer-services/relay/quick-start/optional-parameters
   */
  private static GAS_LIMIT_BUFFER = BigInt(150_000);

  private readonly baseUri: string;

  constructor(
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUri =
      this.configurationService.getOrThrow<string>('relay.baseUri');
  }

  async relay(args: {
    chainId: string;
    to: string;
    data: string;
    gasLimit?: string;
  }): Promise<{ taskId: string }> {
    const sponsorApiKey = this.configurationService.getOrThrow<string>(
      `relay.apiKey.${args.chainId}`,
    );

    try {
      const url = `${this.baseUri}/relays/v2/sponsored-call`;
      const { data } = await this.networkService.post<{ taskId: string }>(url, {
        sponsorApiKey,
        chainId: args.chainId,
        target: args.to,
        data: args.data,
        ...(args.gasLimit && {
          gasLimit: this.getRelayGasLimit(args.gasLimit),
        }),
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  private getRelayGasLimit(gasLimit: string): string {
    return (BigInt(gasLimit) + GelatoApi.GAS_LIMIT_BUFFER).toString();
  }
}
