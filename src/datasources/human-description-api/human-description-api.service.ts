import { Injectable } from '@nestjs/common';
import { IHumanDescriptionApi } from '../../domain/interfaces/human-description-api.interface';
import { FunctionSignature } from '../../domain/human-description/entities/human-description.entity';
import ContractDescriptions from './json';

@Injectable()
export class HumanDescriptionApi implements IHumanDescriptionApi {
  getDescriptions(): Record<FunctionSignature, string> {
    return ContractDescriptions;
  }
}
