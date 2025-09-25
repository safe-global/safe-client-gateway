import type { RecipientAnalysisResult } from '@/modules/safe-shield/entities/analysis-result.entity';
import type { RecipientStatus } from '@/modules/safe-shield/entities/recipient-status.entity';
import type { BridgeStatus } from '@/modules/safe-shield/entities/bridge-status.entity';
import {
  SEVERITY_MAPPING,
  TITLE_MAPPING,
  DESCRIPTION_MAPPING,
} from './recipient-analysis.constants';

/**
 * Maps a recipient or bridge status to an analysis result.
 * @param type - The recipient or bridge status.
 * @param interactions - The number of interactions with the recipient (required for RecipientStatus).
 * @returns The analysis result.
 */
export function mapToAnalysisResult(
  type: RecipientStatus,
  interactions: number,
): RecipientAnalysisResult;
export function mapToAnalysisResult(type: BridgeStatus): RecipientAnalysisResult;
export function mapToAnalysisResult(
  type: RecipientStatus | BridgeStatus,
  interactions?: number,
): RecipientAnalysisResult {
  const severity = SEVERITY_MAPPING[type];
  const title = TITLE_MAPPING[type];
  const description = DESCRIPTION_MAPPING[type](interactions ?? 0);

  return { severity, type, title, description };
}
