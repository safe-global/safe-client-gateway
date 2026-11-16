// SPDX-License-Identifier: FSL-1.1-MIT
import type { FunctionSignature } from '#/modules/human-description/domain/entities/human-description.entity';

export const IHumanDescriptionApi = Symbol('IHumanDescriptionApi');

export interface IHumanDescriptionApi {
  getDescriptions(): Record<FunctionSignature, string>;
}
