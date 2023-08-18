import {
  Expression,
  HumanReadableFragment,
  MessageTemplates,
  ValueType,
} from '../../datasources/human-description-api/entities/human-description.entity';

export const IHumanDescriptionApi = Symbol('IHumanDescriptionApi');

export interface IHumanDescriptionApi {
  getParsedMessages(): MessageTemplates;
  parseMessages(messages: Expression): MessageTemplates;
  parseExpression(
    valueType: ValueType,
    valueIndex: number,
    to: string,
    params: unknown[],
  ): HumanReadableFragment | null;
  parseParam(
    valueType: ValueType,
    valueIndex: number,
    to: string,
    params: unknown[],
  ): HumanReadableFragment['value'];
}
