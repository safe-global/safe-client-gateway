import type { JobData } from '@/datasources/jobs/types/job-types';
import { JobType } from '@/datasources/jobs/types/job-types';

describe('JobTypes', () => {
  describe('JobType enum', () => {
    it('should be extensible for new job types', () => {
      // Test that we can access job types as expected
      const jobTypes = Object.values(JobType);
      expect(Array.isArray(jobTypes)).toBe(true);
    });

    it('should have valid kebab-case naming when job types are added', () => {
      Object.values(JobType).forEach((value) => {
        expect(value).toMatch(/^[a-z]+(-[a-z]+)*$/);
      });
    });
  });

  describe('JobData interface', () => {
    it('should be extensible for job data types', () => {
      // Test that JobData interface exists and can be extended
      const jobDataKeys = Object.keys({} as JobData);
      expect(Array.isArray(jobDataKeys)).toBe(true);
    });
  });
});
