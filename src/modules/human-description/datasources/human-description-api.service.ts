import { Injectable } from '@nestjs/common';
import { IHumanDescriptionApi } from '@/domain/interfaces/human-description-api.interface';
import { type FunctionSignature } from '@/modules/human-description/domain/entities/human-description.entity';
import ContractDescriptions from '@/modules/human-description/datasources/json';

@Injectable()
export class HumanDescriptionApi implements IHumanDescriptionApi {
  getDescriptions(): Record<FunctionSignature, string> {
    return ContractDescriptions;
  }
}
