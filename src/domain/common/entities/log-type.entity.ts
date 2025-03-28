export enum LogType {
  CacheError = 'CACHE_ERROR',
  CacheEvent = 'CACHE_EVENT',
  CacheHit = 'CACHE_HIT',
  CacheMiss = 'CACHE_MISS',
  ExternalRequest = 'EXTERNAL_REQUEST',
  MemoryHit = 'MEMORY_HIT',
  MemoryMiss = 'MEMORY_MISS',
  MessagePropose = 'MESSAGE_PROPOSE',
  MessageValidity = 'MESSAGE_VALIDITY',
  TransactionPropose = 'TRANSACTION_PROPOSE',
  TransactionValidity = 'TRANSACTION_VALIDITY',
}
