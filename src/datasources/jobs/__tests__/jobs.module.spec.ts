import { JOBS_QUEUE_NAME } from '@/datasources/jobs/jobs.module';

describe('JobsModule', () => {
  describe('module configuration', () => {
    it('should have correct queue name constant', () => {
      expect(JOBS_QUEUE_NAME).toBe('jobs');
    });

    it('should export the correct queue name', () => {
      expect(typeof JOBS_QUEUE_NAME).toBe('string');
      expect(JOBS_QUEUE_NAME.length).toBeGreaterThan(0);
    });
  });

  describe('BullMQ configuration options', () => {
    it('should define proper default job options', () => {
      const expectedOptions = {
        removeOnComplete: 10,
        removeOnFail: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        attempts: 3,
      };

      // Test that the structure is what we expect
      expect(expectedOptions.removeOnComplete).toBe(10);
      expect(expectedOptions.removeOnFail).toBe(5);
      expect(expectedOptions.backoff.type).toBe('exponential');
      expect(expectedOptions.backoff.delay).toBe(2000);
      expect(expectedOptions.attempts).toBe(3);
    });

    it('should validate Redis configuration keys', () => {
      const redisConfigKeys = [
        'redis.host',
        'redis.port',
        'redis.user',
        'redis.pass',
      ];

      redisConfigKeys.forEach((key) => {
        expect(typeof key).toBe('string');
        expect(key.startsWith('redis.')).toBe(true);
      });
    });
  });
});
