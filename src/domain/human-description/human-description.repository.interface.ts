import {
  HumanDescriptions,
  HumanDescriptionFragment,
  HumanDescriptionTemplates,
  ValueType,
} from './entities/human-description.entity';

export const IHumanDescriptionRepository = Symbol(
  'IHumanDescriptionRepository',
);

export interface IHumanDescriptionRepository {
  getDescriptions(): HumanDescriptionTemplates;
  parseDescriptions(descriptions: HumanDescriptions): HumanDescriptionTemplates;

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
