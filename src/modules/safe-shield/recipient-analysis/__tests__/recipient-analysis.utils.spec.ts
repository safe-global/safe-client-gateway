import { mapToAnalysisResult } from '../recipient-analysis.utils';

describe('recipient-analysis.utils', () => {
  describe('mapToAnalysisResult', () => {
    it('should map recipient status with interactions', () => {
      const result = mapToAnalysisResult('KNOWN_RECIPIENT', 5);

      expect(result).toEqual({
        severity: 'OK',
        type: 'KNOWN_RECIPIENT',
        title: 'Recurring recipient',
        description: 'You have interacted with this address 5 times.',
      });
    });

    it('should map new recipient status', () => {
      const result = mapToAnalysisResult('NEW_RECIPIENT', 0);

      expect(result).toEqual({
        severity: 'INFO',
        type: 'NEW_RECIPIENT',
        title: 'New Recipient',
        description:
          'You are interacting with this address for the first time.',
      });
    });

    it('should handle single interaction correctly', () => {
      const result = mapToAnalysisResult('KNOWN_RECIPIENT', 1);

      expect(result).toEqual({
        severity: 'OK',
        type: 'KNOWN_RECIPIENT',
        title: 'Recurring recipient',
        description: 'You have interacted with this address 1 time.',
      });
    });

    it('should handle very large interaction counts', () => {
      const result = mapToAnalysisResult('KNOWN_RECIPIENT', 10000);

      expect(result).toEqual({
        severity: 'OK',
        type: 'KNOWN_RECIPIENT',
        title: 'Recurring recipient',
        description: 'You have interacted with this address 10000 times.',
      });
    });

    it('should map bridge status without interactions parameter', () => {
      const result = mapToAnalysisResult('INCOMPATIBLE_SAFE');

      expect(result).toEqual({
        severity: 'CRITICAL',
        type: 'INCOMPATIBLE_SAFE',
        title: 'Incompatible Safe version',
        description: 'This Safe account cannot be created on the destination chain. You will not be able to claim ownership of the same address. Funds sent may be inaccessible.',
      });
    });

    it('should map missing ownership bridge status', () => {
      const result = mapToAnalysisResult('MISSING_OWNERSHIP');

      expect(result).toEqual({
        severity: 'WARN',
        type: 'MISSING_OWNERSHIP',
        title: 'Missing ownership',
        description: 'This Safe account is not activated on the target chain. First, create the Safe, execute a test transaction, and then proceed with bridging. Funds sent may be inaccessible.',
      });
    });

    it('should map unsupported network bridge status', () => {
      const result = mapToAnalysisResult('UNSUPPORTED_NETWORK');

      expect(result).toEqual({
        severity: 'WARN',
        type: 'UNSUPPORTED_NETWORK',
        title: 'Unsupported network',
        description: 'app.safe.global does not support the network. Unless you have a wallet deployed there, we recommend not to bridge. Funds sent may be inaccessible.',
      });
    });

    it('should map different safe setup bridge status', () => {
      const result = mapToAnalysisResult('DIFFERENT_SAFE_SETUP');

      expect(result).toEqual({
        severity: 'INFO',
        type: 'DIFFERENT_SAFE_SETUP',
        title: 'Different setup',
        description: 'Your Safe exists on the target chain but with a different configuration. Review carefully before proceeding. Funds sent may be inaccessible if the setup is incorrect.',
      });
    });
  });
});
