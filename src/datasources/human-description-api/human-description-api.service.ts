import { Inject, Injectable } from '@nestjs/common';
import { IHumanDescriptionApi } from '../../domain/interfaces/human-description-api.interface';
import {
  MessageTemplates,
  HumanReadableFragment,
  ValueType,
  Expression,
} from './entities/human-description.entity';

const isValueType = (type: unknown): type is ValueType => {
  return Object.values(ValueType).includes(type as ValueType);
};

@Injectable()
export class HumanDescriptionApi implements IHumanDescriptionApi {
  private readonly parsedMessages: MessageTemplates;

  /**
   *  Regex Template that matches two patterns
   *  1. Double curly braces consisting of 2 groups separated by a space
   *  2. Any non-whitespace character i.e. simple words
   */
  private readonly templateRegex = /{{(.*?)\s(\$.*?)}}|(\S+)/g;

  constructor(
    @Inject('ContractDescriptions')
    private readonly contractDescriptions: Expression,
  ) {
    this.parsedMessages = this.parseMessages(this.contractDescriptions);
  }

  getParsedMessages(): MessageTemplates {
    return this.parsedMessages;
  }

  parseMessages(messages: Expression): MessageTemplates {
    const messageTemplates: MessageTemplates = {};

    for (const callSignature in messages) {
      const template = messages[callSignature];

      messageTemplates[callSignature] = {
        process: (to: string, params: unknown[]) => {
          const fragments: HumanReadableFragment[] = [];

          let match: RegExpExecArray | null;

          while ((match = this.templateRegex.exec(template)) !== null) {
            const [fullMatch, valueType, valueIndexPrefixed] = match;

            if (valueType !== undefined && !isValueType(valueType)) continue;

            // Just a simple string
            if (fullMatch && !valueType && !valueIndexPrefixed) {
              fragments.push({
                type: ValueType.Word,
                value: fullMatch,
              });
              continue;
            }

            // We slice the first character of the valueIndex since it has the structure of $<index>
            const valueIndex = valueIndexPrefixed.slice(1);

            const parsedExpression = this.parseExpression(
              valueType,
              Number(valueIndex),
              to,
              params,
            );

            fragments.push(parsedExpression);
          }

          return fragments;
        },
      };
    }

    return messageTemplates;
  }

  parseExpression(
    valueType: ValueType,
    valueIndex: number,
    to: string,
    params: unknown[],
  ): HumanReadableFragment {
    const parsedParams = this.parseParams(valueType, valueIndex, to, params);

    return <HumanReadableFragment>{
      type: valueType,
      value: parsedParams,
    };
  }

  parseParams(
    valueType: ValueType,
    valueIndex: number,
    to: string,
    params: unknown[],
  ): HumanReadableFragment['value'] {
    switch (valueType) {
      case ValueType.TokenValue:
        const amount = params[valueIndex];
        const address = to;

        return {
          amount,
          address,
        };
      case ValueType.Address:
      case ValueType.Decimals:
      case ValueType.Identifier:
        return params[valueIndex];
      default:
        return to;
    }
  }
}
