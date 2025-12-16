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
  } as const;

  /**
   * Generates a circuit breaker key for the transaction service
   *
   * @param chainId - The chain ID to scope the circuit breaker to
   * @returns Circuit breaker key in the format: `txs-service-{chainId}`
   */
  static getTransactionServiceKey(chainId: string): string {
    return `${CircuitBreakerKeys.SERVICE_PREFIX.TRANSACTION_SERVICE}-${chainId}`;
  }
}
