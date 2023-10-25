import { Inject, Injectable } from '@nestjs/common';
import { Contract, ContractId } from '@/domain/alerts/entities/alerts.entity';
import { IAlertsApi } from '@/domain/interfaces/alerts-api.inferface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';

@Injectable()
export class TenderlyApi implements IAlertsApi {
  private static readonly HEADER: string = 'X-Access-Key';

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly account: string;
  private readonly project: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.apiKey = this.configurationService.getOrThrow<string>('alerts.apiKey');
    this.baseUrl =
      this.configurationService.getOrThrow<string>('alerts.baseUri');
    this.account =
      this.configurationService.getOrThrow<string>('alerts.account');
    this.project =
      this.configurationService.getOrThrow<string>('alerts.project');
  }

  async addContracts(contracts: Array<Contract>): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v2/accounts/${this.account}/projects/${this.project}/contracts`;
      await this.networkService.post(url, {
        headers: {
          [TenderlyApi.HEADER]: this.apiKey,
        },
        params: {
          contracts: contracts.map((contract) => ({
            address: contract.address,
            display_name: contract.displayName,
            network_id: contract.chainId,
          })),
        },
      });
    } catch (error) {
      this.httpErrorFactory.from(error);
    }
  }

  async removeContracts(contractIds: Array<ContractId>): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v2/accounts/${this.account}/projects/${this.project}/contracts`;
      await this.networkService.delete(url, {
        headers: {
          [TenderlyApi.HEADER]: this.apiKey,
        },
        params: {
          contract_ids: contractIds,
        },
      });
    } catch (error) {
      this.httpErrorFactory.from(error);
    }
  }
}
