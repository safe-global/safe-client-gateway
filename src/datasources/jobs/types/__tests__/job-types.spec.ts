import type { JobData } from '@/datasources/jobs/types/job-types';
import { JobType } from '@/datasources/jobs/types/job-types';

describe('JobTypes', () => {
  describe('JobType enum', () => {
    it('should have HELLO_WORLD job type', () => {
      expect(JobType.HELLO_WORLD).toBe('hello-world');
    });

    it('should have string values', () => {
      Object.values(JobType).forEach(value => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });

    it('should have valid kebab-case naming', () => {
      Object.values(JobType).forEach(value => {
        expect(value).toMatch(/^[a-z]+(-[a-z]+)*$/);
      });
    });

    it('should be extensible for new job types', () => {
      // Test that we can access job types as expected
      const jobTypes = Object.values(JobType);
      expect(jobTypes.length).toBeGreaterThan(0);
      
      // Verify the current job type exists
      expect(jobTypes).toContain('hello-world');
    });
  });

  describe('JobData interface', () => {
    it('should define data structure for HELLO_WORLD jobs', () => {
      const helloWorldData: JobData['hello-world'] = {
        message: 'test message',
        timestamp: Date.now(),
      };

      expect(helloWorldData.message).toBe('test message');
      expect(typeof helloWorldData.timestamp).toBe('number');
    });

    it('should enforce required properties', () => {
      // This test ensures TypeScript compilation would fail for invalid data
      const validData: JobData['hello-world'] = {
        message: 'required message',
        timestamp: 1234567890,
      };

      expect(validData.message).toBeDefined();
      expect(validData.timestamp).toBeDefined();
    });

    it('should handle different message types', () => {
      const testCases = [
        'Simple message',
        'Message with numbers 123',
        'Message with special chars: !@#$%^&*()',
        'Multi-line\nmessage\nwith\nbreaks',
        'Very long message '.repeat(100),
        '',
      ];

      testCases.forEach(message => {
        const data: JobData['hello-world'] = {
          message,
          timestamp: Date.now(),
        };

        expect(data.message).toBe(message);
        expect(typeof data.timestamp).toBe('number');
      });
    });

    it('should handle various timestamp values', () => {
      const timestamps = [
        Date.now(),
        0,
        1640995200000, // Jan 1, 2022
        Math.floor(Date.now() / 1000), // Unix timestamp in seconds
        new Date().getTime(),
      ];

      timestamps.forEach(timestamp => {
        const data: JobData['hello-world'] = {
          message: 'test',
          timestamp,
        };

        expect(data.timestamp).toBe(timestamp);
        expect(typeof data.timestamp).toBe('number');
      });
    });
  });
});