import { getDeploymentVersionsByChainIds } from '@/__tests__/deployments.helper';

describe('Deployments helper', () => {
  describe('getDeploymentVersionsByChainIds', () => {
    it('should return all CompatibilityFallbackHandler versions for the specified chain ID', () => {
      const versions = getDeploymentVersionsByChainIds(
        'CompatibilityFallbackHandler',
        ['100', '11155111'],
      );

      expect(versions).toStrictEqual({
        '100': ['1.3.0', '1.4.1'],
        '11155111': ['1.3.0', '1.4.1'],
      });
    });

    it('should return all CreateCall versions for the specified chain ID', () => {
      const versions = getDeploymentVersionsByChainIds('CreateCall', [
        '100',
        '11155111',
      ]);

      expect(versions).toStrictEqual({
        '100': ['1.3.0', '1.4.1'],
        '11155111': ['1.3.0', '1.4.1'],
      });
    });

    it('should return all DefaultCallbackHandler versions for the specified chain ID', () => {
      const versions = getDeploymentVersionsByChainIds(
        'DefaultCallbackHandler',
        ['100', '11155111'],
      );

      expect(versions).toStrictEqual({
        '100': ['1.1.1'],
        '11155111': [],
      });
    });

    it('should return all MultiSend for the specified chain ID', () => {
      const versions = getDeploymentVersionsByChainIds('MultiSend', [
        '100',
        '11155111',
      ]);

      expect(versions).toStrictEqual({
        '100': ['1.1.1', '1.3.0', '1.4.1'],
        '11155111': ['1.3.0', '1.4.1'],
      });
    });

    it('should return all MultiSendCallOnly versions for the specified chain ID', () => {
      const versions = getDeploymentVersionsByChainIds('MultiSendCallOnly', [
        '100',
        '11155111',
      ]);

      expect(versions).toStrictEqual({
        '100': ['1.3.0', '1.4.1'],
        '11155111': ['1.3.0', '1.4.1'],
      });
    });

    it('should return all ProxyFactory versions for the specified chain ID', () => {
      const versions = getDeploymentVersionsByChainIds('ProxyFactory', [
        '100',
        '11155111',
      ]);

      expect(versions).toStrictEqual({
        '100': ['1.0.0', '1.1.1', '1.3.0', '1.4.1'],
        '11155111': ['1.3.0', '1.4.1'],
      });
    });

    it('should return all Safe versions for the specified chain ID', () => {
      const versions = getDeploymentVersionsByChainIds('Safe', [
        '100',
        '11155111',
      ]);

      expect(versions).toStrictEqual({
        '100': ['1.0.0', '1.1.1', '1.2.0', '1.3.0', '1.4.1'],
        '11155111': ['1.3.0', '1.4.1'],
      });
    });

    it('should return all L2 Safe versions for the specified chain ID', () => {
      const versions = getDeploymentVersionsByChainIds('SafeL2', [
        '100',
        '11155111',
      ]);

      expect(versions).toStrictEqual({
        '100': ['1.3.0', '1.4.1'],
        '11155111': ['1.3.0', '1.4.1'],
      });
    });

    it('should return all SignMessageLib versions for the specified chain ID', () => {
      const versions = getDeploymentVersionsByChainIds('SignMessageLib', [
        '100',
        '11155111',
      ]);

      expect(versions).toStrictEqual({
        '100': ['1.3.0', '1.4.1'],
        '11155111': ['1.3.0', '1.4.1'],
      });
    });

    it('should return all SimulateTxAccessor versions for the specified chain ID', () => {
      const versions = getDeploymentVersionsByChainIds('SimulateTxAccessor', [
        '100',
        '11155111',
      ]);

      expect(versions).toStrictEqual({
        '100': ['1.3.0', '1.4.1'],
        '11155111': ['1.3.0', '1.4.1'],
      });
    });
  });
});
