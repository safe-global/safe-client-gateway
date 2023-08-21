import {
  Expression,
  HumanDescriptionFragment,
  HumanDescriptionTemplates,
  ValueType,
} from '../../datasources/human-description-api/entities/human-description.entity';

export const IHumanDescriptionApi = Symbol('IHumanDescriptionApi');

export interface IHumanDescriptionApi {
  getParsedDescriptions(): HumanDescriptionTemplates;
  parseDescriptions(descriptions: Expression): HumanDescriptionTemplates;
  parseExpression(
    valueType: ValueType,
    valueIndex: number,
    to: string,
    params: unknown[],
  ): HumanDescriptionFragment | null;
  parseParam(
    valueType: ValueType,
    valueIndex: number,
    to: string,
    params: unknown[],
  ): HumanDescriptionFragment['value'];
}
