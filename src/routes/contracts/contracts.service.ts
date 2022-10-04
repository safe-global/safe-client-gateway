import { Injectable } from '@nestjs/common';
import { ContractsRepository } from '../../domain/contracts/contracts.repository';
import { Contract } from '../../domain/contracts/entities/contract.entity';

@Injectable()
export class ContractsService {
  constructor(private readonly contractsRepository: ContractsRepository) {}

  async getContract(
    chainId: string,
    contractAddress: string,
  ): Promise<Contract> {
    return this.contractsRepository.getContract(chainId, contractAddress);
  }
}
