import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import {
  type RecipientAnalysisResult,
  type ContractAnalysisResult,
  type ThreatAnalysisResult,
} from '../../analysis-result.entity';

/**
 * Builder for RecipientAnalysisResult entities
 */
export function recipientAnalysisResultBuilder(): IBuilder<RecipientAnalysisResult> {
  return new Builder<RecipientAnalysisResult>()
    .with('severity', 'INFO')
    .with('type', 'KNOWN_RECIPIENT')
    .with('title', faker.lorem.sentence())
    .with('description', faker.lorem.paragraph());
}

/**
 * Builder for ContractAnalysisResult entities
 */
export function contractAnalysisResultBuilder(): IBuilder<ContractAnalysisResult> {
  return new Builder<ContractAnalysisResult>()
    .with('severity', 'INFO')
    .with('type', 'VERIFIED')
    .with('title', faker.lorem.sentence())
    .with('description', faker.lorem.paragraph());
}

/**
 * Builder for ThreatAnalysisResult entities
 */
export function threatAnalysisResultBuilder(): IBuilder<ThreatAnalysisResult> {
  return new Builder<ThreatAnalysisResult>()
    .with('severity', 'OK')
    .with('type', 'NO_THREAT')
    .with('title', faker.lorem.sentence())
    .with('description', faker.lorem.paragraph());
}
