import configuration from '@/config/entities/configuration';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('safeConfig.cgwServiceKey', () => {
    it('should default to "CGW" when SAFE_CONFIG_CGW_KEY is not set', () => {
      delete process.env.SAFE_CONFIG_CGW_KEY;
      const config = configuration();
      expect(config.safeConfig.cgwServiceKey).toBe('CGW');
    });

    it('should use custom value when SAFE_CONFIG_CGW_KEY is set', () => {
      process.env.SAFE_CONFIG_CGW_KEY = 'custom-cgw-key';
      const config = configuration();
      expect(config.safeConfig.cgwServiceKey).toBe('custom-cgw-key');
    });

    it('should use default "CGW" when SAFE_CONFIG_CGW_KEY is empty', () => {
      process.env.SAFE_CONFIG_CGW_KEY = '';
      const config = configuration();
      expect(config.safeConfig.cgwServiceKey).toBe('CGW');
    });
  });
});
