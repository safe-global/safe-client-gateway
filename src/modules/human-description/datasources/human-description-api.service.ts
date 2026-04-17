import { Injectable } from '@nestjs/common';
import type { IHumanDescriptionApi } from '@/domain/interfaces/human-description-api.interface';
import ContractDescriptions from '@/modules/human-description/datasources/json';
import type { FunctionSignature } from '@/modules/human-description/domain/entities/human-description.entity';

@Injectable()
export class HumanDescriptionApi implements IHumanDescriptionApi {
  getDescriptions(): Record<FunctionSignature, string> {
    return ContractDescriptions;
  }
}
