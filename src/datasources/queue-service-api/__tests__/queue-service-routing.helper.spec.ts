// SPDX-License-Identifier: FSL-1.1-MIT
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { QueueServiceRoutingHelper } from '../queue-service-routing.helper';

describe('QueueServiceRoutingHelper', () => {
  describe('when queue service is enabled', () => {
    const mockConfigurationService = {
      getOrThrow: jest.fn(),
    } as jest.MockedObjectDeep<IConfigurationService>;

    let helper: QueueServiceRoutingHelper;

    beforeEach(() => {
      jest.clearAllMocks();
      mockConfigurationService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'features.queueService') return true;
        throw new Error(`Unexpected key: ${key}`);
      });
      helper = new QueueServiceRoutingHelper(mockConfigurationService);
    });

    it('isEnabled returns true', () => {
      expect(helper.isEnabled).toBe(true);
    });

    it('route() calls whenEnabled', async () => {
      const whenEnabled = jest.fn().mockResolvedValue('enabled-result');
      const whenDisabled = jest.fn().mockResolvedValue('disabled-result');

      const result = await helper.route({ whenEnabled, whenDisabled });

      expect(result).toBe('enabled-result');
      expect(whenEnabled).toHaveBeenCalledTimes(1);
      expect(whenDisabled).not.toHaveBeenCalled();
    });
  });

  describe('when queue service is disabled', () => {
    const mockConfigurationService = {
      getOrThrow: jest.fn(),
    } as jest.MockedObjectDeep<IConfigurationService>;

    let helper: QueueServiceRoutingHelper;

    beforeEach(() => {
      jest.clearAllMocks();
      mockConfigurationService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'features.queueService') return false;
        throw new Error(`Unexpected key: ${key}`);
      });
      helper = new QueueServiceRoutingHelper(mockConfigurationService);
    });

    it('isEnabled returns false', () => {
      expect(helper.isEnabled).toBe(false);
    });

    it('route() calls whenDisabled', async () => {
      const whenEnabled = jest.fn().mockResolvedValue('enabled-result');
      const whenDisabled = jest.fn().mockResolvedValue('disabled-result');

      const result = await helper.route({ whenEnabled, whenDisabled });

      expect(result).toBe('disabled-result');
      expect(whenDisabled).toHaveBeenCalledTimes(1);
      expect(whenEnabled).not.toHaveBeenCalled();
    });
  });
});
