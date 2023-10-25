import { Contract, ContractId } from '@/domain/alerts/entities/alert.entity';

export const IAlertsApi = Symbol('IAlertsApi');

export interface IAlertsApi {
  addContracts(contracts: Array<Contract>): Promise<void>;

  removeContracts(contractIds: Array<ContractId>): Promise<void>;
}
