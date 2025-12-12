import { Global, Module } from '@nestjs/common';
import { CircuitBreakerService } from '@/datasources/circuit-breaker/circuit-breaker.service';

/**
 * Global module that provides circuit breaker functionality across the application
 */
@Global()
@Module({
  providers: [CircuitBreakerService],
  exports: [CircuitBreakerService],
})
export class CircuitBreakerModule {}
