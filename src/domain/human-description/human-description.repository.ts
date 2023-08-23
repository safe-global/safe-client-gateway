import { Inject, Injectable } from '@nestjs/common';
import { IHumanDescriptionRepository } from './human-description.repository.interface';
import {
  HumanDescriptionFragment,
  HumanDescriptions,
  HumanDescriptionTemplates,
  ValueType,
} from './entities/human-description.entity';
import { IHumanDescriptionApi } from '../interfaces/human-description-api.interface';
import { getFunctionSelector, parseAbi } from 'viem';

@Injectable()
export class HumanDescriptionRepository implements IHumanDescriptionRepository {
  private readonly parsedDescriptions: HumanDescriptionTemplates;

  /**
   *  Regex Template that matches two patterns
   *  1. Double curly braces consisting of 2 groups separated by a space
   *  2. Any non-whitespace character i.e. simple words
   */
  private static readonly TEMPLATE_REGEX = /{{(.*?)\s(\$.*?)}}|(\S+)/g;

  constructor(
    @Inject(IHumanDescriptionApi)
    private readonly humanDescriptionApi: IHumanDescriptionApi,
  ) {
    const humanDescriptions = this.humanDescriptionApi.getDescriptions();
    this.parsedDescriptions = this.parseDescriptions(humanDescriptions);
  }

  getDescriptions(): HumanDescriptionTemplates {
    return this.parsedDescriptions;
  }

  parseDescriptions(
    descriptions: HumanDescriptions,
  ): HumanDescriptionTemplates {
    const templates: HumanDescriptionTemplates = {};

    for (const signature in descriptions) {
      const template = descriptions[signature];
      const sigHash = getFunctionSelector(signature);
      const abi = parseAbi([signature]);

      templates[sigHash] = {
        abi,
        process: (to: string, params: unknown[]) => {
          const fragments: HumanDescriptionFragment[] = [];

          const matches = [
            ...template.matchAll(HumanDescriptionRepository.TEMPLATE_REGEX),
          ];

          for (const match of matches) {
            const [fullMatch, valueType, valueIndexPrefixed] = match;

            if (valueType !== undefined && !this.isValueType(valueType))
              continue;

            // Matched a simple string
            if (fullMatch && !valueType && !valueIndexPrefixed) {
              fragments.push({
                type: ValueType.Word,
                value: fullMatch,
              });
              continue;
            }

            // Slice the first character of the valueIndex to remove $ prefix
            const valueIndex = valueIndexPrefixed.slice(1);

            const parsedExpression = this.parseExpression(
              valueType,
              Number(valueIndex),
              to,
              params,
            );

            if (parsedExpression) {
              fragments.push(parsedExpression);
            }
          }

          return fragments;
        },
      };
    }

    return templates;
  }

  parseExpression(
    valueType: ValueType,
    valueIndex: number,
    to: string,
    params: unknown[],
  ): HumanDescriptionFragment | null {
    try {
      const parsedParam = this.parseParam(valueType, valueIndex, to, params);

      return <HumanDescriptionFragment>{
        type: valueType,
        value: parsedParam,
      };
    } catch {
      return null;
    }
  }

  parseParam(
    valueType: ValueType,
    valueIndex: number,
    to: string,
    params: unknown[],
  ): HumanDescriptionFragment['value'] {
    switch (valueType) {
      case ValueType.TokenValue:
        return {
          amount: params[valueIndex],
          address: to,
        };
      case ValueType.Address:
      case ValueType.Decimals:
      case ValueType.Identifier:
      case ValueType.Word:
        return params[valueIndex];
      default:
        throw Error(`${valueType} is not allowed as ValueType`);
    }
  }

  private isValueType(type: unknown): type is ValueType {
    return Object.values(ValueType).includes(type as ValueType);
  }
}
