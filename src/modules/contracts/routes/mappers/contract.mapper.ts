import { Injectable } from '@nestjs/common';
import { type Contract } from '@/modules/contracts/domain/entities/contract.entity';
import { type Contract as DataDecoderContract } from '@/modules/data-decoder/domain/v2/entities/contract.entity';

@Injectable()
export class ContractMapper {
  public constructor() {}

  public map(contract: DataDecoderContract): Contract {
    const contractAbi = contract.abi?.abiJson
      ? { abi: contract.abi.abiJson }
      : null;
    return {
      address: contract.address,
      name: contract.name,
      displayName: contract.displayName,
      logoUri: contract.logoUrl ?? null,
      contractAbi,
      trustedForDelegateCall: contract.trustedForDelegateCall,
    };
  }
}
