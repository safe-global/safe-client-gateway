import { Injectable } from '@nestjs/common';
import { Contract } from '@/domain/contracts/entities/contract.entity';
import { Contract as DataDecoderContract } from '@/domain/data-decoder/v2/entities/contract.entity';

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
      displayName: contract.displayName ?? '',
      logoUri: contract.logoUrl,
      contractAbi,
      trustedForDelegateCall: contract.trustedForDelegateCall,
    };
  }
}
