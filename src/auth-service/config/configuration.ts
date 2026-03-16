// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * Auth Service Configuration
 *
 * Minimal configuration for the auth service. Only includes settings
 * that are relevant to authentication functionality.
 *
 * This file is separate from the gateway configuration to:
 * - Avoid loading unnecessary gateway config (chains, relay, email, etc.)
 * - Make future extraction to a dedicated repository easier
 * - Keep auth service tests simpler
 */

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default () => ({
  about: {
    name: 'safe-auth-service',
    version: process.env.APPLICATION_VERSION,
    buildNumber: process.env.APPLICATION_BUILD_NUMBER,
  },
  application: {
    isProduction: process.env.AUTH_ENV === 'production',
    isDevelopment: process.env.AUTH_ENV === 'development',
    // Enables/disables the execution of migrations on startup.
    runMigrations: process.env.RUN_MIGRATIONS?.toLowerCase() !== 'false',
    port: process.env.APPLICATION_PORT || '3001',
    allowCors: process.env.ALLOW_CORS?.toLowerCase() === 'true',
  },
  auth: {
    token: process.env.AUTH_TOKEN,
    nonceTtlSeconds: parseInt(
      process.env.AUTH_NONCE_TTL_SECONDS ?? `${5 * 60}`,
    ),
    maxValidityPeriodSeconds: parseInt(
      process.env.AUTH_VALIDITY_PERIOD_SECONDS ?? `${24 * 60 * 60}`, // 24 hours
    ),
  },
  db: {
    migrator: {
      executeMigrations:
        process.env.DB_MIGRATIONS_EXECUTE?.toLowerCase() !== 'false',
      numberOfRetries: process.env.DB_MIGRATIONS_NUMBER_OF_RETRIES ?? 5,
      retryAfterMs: process.env.DB_MIGRATIONS_RETRY_AFTER_MS ?? 1000,
    },
    orm: {
      migrationsRun: false,
      autoLoadEntities: true,
      manualInitialization: true,
      migrationsTableName:
        process.env.ORM_MIGRATION_TABLE_NAME || '_migrations',
      // Auth service uses its own Redis for ORM cache
      cache:
        process.env.ORM_CACHE_ENABLED?.toLowerCase() === 'true'
          ? {
              type: 'redis',
              options: {
                socket: {
                  host: process.env.REDIS_HOST || 'localhost',
                  port: process.env.REDIS_PORT || '6379',
                },
                username: process.env.REDIS_USER,
                password: process.env.REDIS_PASS,
              },
              duration: parseInt(process.env.ORM_CACHE_DURATION ?? `${1000}`),
              ignoreErrors: true,
            }
          : false,
    },
    connection: {
      postgres: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || '5432',
        database: process.env.POSTGRES_DB || 'safe-auth-service',
        schema: process.env.POSTGRES_SCHEMA || 'main',
        username: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        ssl: {
          enabled: process.env.POSTGRES_SSL_ENABLED?.toLowerCase() === 'true',
          requestCert:
            process.env.POSTGRES_SSL_REQUEST_CERT?.toLowerCase() !== 'false',
          rejectUnauthorized:
            process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED?.toLowerCase() !==
            'false',
          caPath: process.env.POSTGRES_SSL_CA_PATH,
        },
      },
    },
  },
  expirationTimeInSeconds: {
    deviatePercent: parseInt(process.env.EXPIRATION_DEVIATE_PERCENT ?? `${10}`),
    default: parseInt(process.env.EXPIRATION_TIME_DEFAULT_SECONDS ?? `${60}`),
    notFound: {
      default: parseInt(
        process.env.DEFAULT_NOT_FOUND_EXPIRE_TIME_SECONDS ?? `${30}`,
      ),
    },
  },
  express: {
    jsonLimit: process.env.EXPRESS_JSON_LIMIT ?? '1mb',
  },
  features: {
    //TODO - figure out whether auth  part of config still makes sense
    auth: process.env.FF_AUTH?.toLowerCase() === 'true',
    cacheInFlightRequests:
      process.env.HTTP_CLIENT_CACHE_IN_FLIGHT_REQUESTS?.toLowerCase() !==
      'false',
    debugLogs: process.env.FF_DEBUG_LOGS?.toLowerCase() === 'true',
  },
  jwt: {
    issuer: process.env.JWT_ISSUER,
    secret: process.env.JWT_SECRET,
  },
  log: {
    level: process.env.LOG_LEVEL || 'debug',
    silent: process.env.LOG_SILENT?.toLowerCase() === 'true',
    prettyColorize: process.env.LOG_PRETTY_COLORIZE?.toLowerCase() === 'true',
  },
  // Auth service uses its own Redis instance
  redis: {
    user: process.env.REDIS_USER,
    pass: process.env.REDIS_PASS,
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
    disableOfflineQueue:
      process.env.REDIS_DISABLE_OFFLINE_QUEUE?.toString() === 'true',
    connectTimeout: process.env.REDIS_CONNECT_TIMEOUT || 10_000,
    keepAlive: process.env.REDIS_KEEP_ALIVE || 30_000,
  },
  circuitBreaker: {
    failureThreshold: parseInt(
      process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD ?? `${20}`,
    ),
    successThreshold: parseInt(
      process.env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD ?? `${10}`,
    ),
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT ?? `${30_000}`),
    rollingWindow: parseInt(
      process.env.CIRCUIT_BREAKER_ROLLING_WINDOW ?? `${60_000}`,
    ),
    halfOpenMaxRequests: parseInt(
      process.env.CIRCUIT_BREAKER_HALF_OPEN_MAX_REQUESTS ?? `${10}`,
    ),
  },
  httpClient: {
    requestTimeout: parseInt(
      process.env.HTTP_CLIENT_REQUEST_TIMEOUT_MILLISECONDS ?? `${5_000}`,
    ),
  },
});
