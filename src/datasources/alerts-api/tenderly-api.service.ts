import { Inject, Injectable } from '@nestjs/common';
import { AlertsRegistration } from '@/domain/alerts/entities/alerts-registration.entity';
import { AlertsDeletion } from '@/domain/alerts/entities/alerts-deletion.entity';
import { IAlertsApi } from '@/domain/interfaces/alerts-api.interface';
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

  /**
   * Add a smart contract to a Tenderly project.
   *
   * Note: If a contract is unverified on both Tenderly and external providers like Etherscan,
   * Blockscout, or Routescan, it will be added to the project as unverified. However, if the
   * contract is verified on an external provider, Tenderly will retrieve and apply the
   * verification, subsequently adding the verified contract to the project.
   *
   * @see https://docs.tenderly.co/reference/api#tag/Contracts/operation/addContractToProject
   */
  async addContract(contract: AlertsRegistration): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v1/account/${this.account}/project/${this.project}/address`;
      await this.networkService.post({
        url,
        data: {
          address: contract.address,
          display_name: contract.displayName,
          network_id: contract.chainId,
        },
        networkRequest: {
          headers: {
            [TenderlyApi.HEADER]: this.apiKey,
          },
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  /**
   * Delete a smart contract from a Tenderly project.
   *
   * @see https://docs.tenderly.co/reference/api#tag/Contracts/operation/deleteContract
   */
  async deleteContract(contract: AlertsDeletion): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v1/account/${this.account}/project/${this.project}/contract/${contract.chainId}/${contract.address}`;
      await this.networkService.delete({
        url,
        networkRequest: {
          headers: {
            [TenderlyApi.HEADER]: this.apiKey,
          },
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
