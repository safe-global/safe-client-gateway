import { HumanDescriptions } from '../human-description/entities/human-description.entity';

export const IHumanDescriptionApi = Symbol('IHumanDescriptionApi');

export interface IHumanDescriptionApi {
  getDescriptions(): HumanDescriptions;
}
