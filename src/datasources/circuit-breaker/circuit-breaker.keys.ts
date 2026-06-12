// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * Circuit Breaker Key Generator
 *
 * Centralized utility for generating consistent circuit breaker keys.
 * This ensures that circuit breaker keys are created in a standardized way
 * and can be easily reused across the application.
 */
export class CircuitBreakerKeys {
  private static readonly SERVICE_PREFIX = {
    TRANSACTION_SERVICE: 'txs-service',
    DATA_DECODER_SERVICE: 'data-decoder-service',
  };

  /**
   * Generates a circuit breaker key for the transaction service
   *
   * @param chainId - The chain ID to scope the circuit breaker to
   * @returns Circuit breaker key in the format: `txs-service-{chainId}`
   */
  static getTransactionServiceKey(chainId: string): string {
    return `${CircuitBreakerKeys.SERVICE_PREFIX.TRANSACTION_SERVICE}-${chainId}`;
  }

  /**
   * Generates the circuit breaker key for the Data Decoder Service
   *
   * The Data Decoder Service is a single deployment serving all chains,
   * so the key is not chain-scoped.
   *
   * @returns Circuit breaker key: `data-decoder-service`
   */
  static getDataDecoderServiceKey(): string {
    return CircuitBreakerKeys.SERVICE_PREFIX.DATA_DECODER_SERVICE;
  }
}
