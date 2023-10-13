import {
  FunctionSignatureHash,
  HumanDescriptionFragment,
} from '@/domain/human-description/entities/human-description.entity';

export const IHumanDescriptionRepository = Symbol(
  'IHumanDescriptionRepository',
);

export interface IHumanDescriptionRepository {
  /**
   * Returns a human description for the provided data.
   *
   * The human description is tied to the provided {@link FunctionSignatureHash}
   */
  getHumanDescription(args: {
    functionSignatureHash: FunctionSignatureHash;
    to: string;
    data: string;
  }): HumanDescriptionFragment[];
}
