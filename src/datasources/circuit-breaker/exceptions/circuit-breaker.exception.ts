import { ServiceUnavailableException } from '@nestjs/common';

export class CircuitBreakerException extends ServiceUnavailableException {}
