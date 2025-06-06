import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ContractsRepository } from '@/domain/contracts/contracts.repository';
import { IContractsRepository } from '@/domain/contracts/contracts.repository.interface';
import { Contract } from '@/domain/contracts/entities/contract.entity';
import { ContractMapper } from '@/routes/contracts/mappers/contract.mapper';

@Injectable()
export class ContractsService {
  constructor(
    @Inject(IContractsRepository)
    private readonly contractsRepository: ContractsRepository,
    private readonly contractMapper: ContractMapper,
  ) {}

  // async getContract(args: {
  //   chainId: string;
  //   contractAddress: `0x${string}`;
  // }): Promise<Contract> {
  //   return this.contractsRepository.getContract(args);
  // }

  async getContract(args: {
    chainId: string;
    contractAddress: `0x${string}`;
  }): Promise<Contract> {
    const { count, results } =
      await this.contractsRepository.getContracts(args);
    if (count === 0) {
      throw new NotFoundException('Error fetching the contract data.');
    }
    return this.contractMapper.mapContract(results[0]);
  }
}
