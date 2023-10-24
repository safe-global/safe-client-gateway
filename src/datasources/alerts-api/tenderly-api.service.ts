import { Injectable } from '@nestjs/common';
import { Contract, ContractId } from '@/domain/alerts/entities/alerts.entity';
import { IAlertsApi } from '@/domain/interfaces/alerts-api.inferface';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkRequest } from '@/datasources/network/entities/network.request.entity';

@Injectable()
export class TenderlyApi implements IAlertsApi {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly account: string;
  private readonly project: string;

  constructor(
    private readonly configurationService: IConfigurationService,
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUrl =
      this.configurationService.getOrThrow<string>('alerts.baseUri');
    this.apiKey = this.configurationService.getOrThrow<string>('alerts.apiKey');
    this.account =
      this.configurationService.getOrThrow<string>('alerts.account');
    this.project =
      this.configurationService.getOrThrow<string>('alerts.project');
  }

  private getHeaders(): NetworkRequest['headers'] {
    return {
      'X-Access-Key': this.apiKey,
    };
  }

  async addContracts(contracts: Array<Contract>): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v2/accounts/${this.account}/projects/${this.project}/contracts`;
      await this.networkService.post(url, {
        headers: this.getHeaders(),
        params: {
          contracts: contracts.map((contract) => ({
            address: contract.address,
            display_name: contract.displayName,
            network_id: contract.networkId,
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
        headers: this.getHeaders(),
        params: {
          contract_ids: contractIds,
        },
      });
    } catch (error) {
      this.httpErrorFactory.from(error);
    }
  }
}
