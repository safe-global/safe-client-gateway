import { Backbone } from './entities/backbone.entity';

export const IBackboneRepository = Symbol('IBackboneRepository');

export interface IBackboneRepository {
  /**
   * Gets the Safe Transaction Service configuration for {@link chainId}
   * @param chainId
   */
  getBackbone(chainId: string): Promise<Backbone>;
}
