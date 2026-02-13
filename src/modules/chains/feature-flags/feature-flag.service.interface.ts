export const IFeatureFlagService = Symbol('IFeatureFlagService');

export interface IFeatureFlagService {
  isFeatureEnabled(chainId: string, featureKey: string): Promise<boolean>;
}
