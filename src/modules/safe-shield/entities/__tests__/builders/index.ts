/**
 * Safe Shield Test Builders
 *
 * Centralized exports for all test builders to simplify imports in test files.
 * Follows the repository pattern of function-based builders returning IBuilder<T>.
 */

// Analysis Result Builders
export {
  recipientAnalysisResultBuilder,
  contractAnalysisResultBuilder,
  threatAnalysisResultBuilder,
} from './analysis-result.builder';

// API Request Builders
export {
  recipientAnalysisRequestBodyBuilder,
  contractAnalysisRequestBodyBuilder,
  threatAnalysisRequestBodyBuilder,
} from './analysis-requests.builder';

// API Response Builders
export {
  recipientAnalysisResponseBuilder,
  contractAnalysisResponseBuilder,
  threatAnalysisResponseBuilder,
} from './analysis-responses.builder';
