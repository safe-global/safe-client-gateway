import {
  FunctionSignature,
  HumanDescriptionFragment,
} from './entities/human-description.entity';

export const IHumanDescriptionRepository = Symbol(
  'IHumanDescriptionRepository',
);

export interface IHumanDescriptionRepository {
  /**
   * Returns a human description for the provided data.
   *
   * The human description is tied to the provided {@link FunctionSignature}
   */
  getHumanDescription(args: {
    functionSignature: FunctionSignature;
    to: string;
    data: string;
  }): HumanDescriptionFragment[];
}
