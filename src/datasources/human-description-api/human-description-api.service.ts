import { Inject, Injectable } from '@nestjs/common';
import { IHumanDescriptionApi } from '../../domain/interfaces/human-description-api.interface';
import {
  HumanDescriptionTemplates,
  HumanDescriptionFragment,
  ValueType,
  Expression,
} from './entities/human-description.entity';

const isValueType = (type: unknown): type is ValueType => {
  return Object.values(ValueType).includes(type as ValueType);
};

@Injectable()
export class HumanDescriptionApi implements IHumanDescriptionApi {
  private readonly parsedDescriptions: HumanDescriptionTemplates;

  /**
   *  Regex Template that matches two patterns
   *  1. Double curly braces consisting of 2 groups separated by a space
   *  2. Any non-whitespace character i.e. simple words
   */
  private static readonly TEMPLATE_REGEX = /{{(.*?)\s(\$.*?)}}|(\S+)/g;

  constructor(
    @Inject('ContractDescriptions')
    private readonly contractDescriptions: Expression,
  ) {
    this.parsedDescriptions = this.parseDescriptions(this.contractDescriptions);
  }

  getParsedDescriptions(): HumanDescriptionTemplates {
    return this.parsedDescriptions;
  }

  parseDescriptions(descriptions: Expression): HumanDescriptionTemplates {
    const templates: HumanDescriptionTemplates = {};

    for (const callSignature in descriptions) {
      const template = descriptions[callSignature];

      templates[callSignature] = {
        process: (to: string, params: unknown[]) => {
          const fragments: HumanDescriptionFragment[] = [];

          let match: RegExpExecArray | null;

          while (
            (match = HumanDescriptionApi.TEMPLATE_REGEX.exec(template)) !== null
          ) {
            const [fullMatch, valueType, valueIndexPrefixed] = match;

            if (valueType !== undefined && !isValueType(valueType)) continue;

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
    } catch (error) {
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
}
