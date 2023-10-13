import { SafeAppAccessControl } from '@/domain/safe-apps/entities/safe-app-access-control.entity';
import { SafeAppProvider } from '@/domain/safe-apps/entities/safe-app-provider.entity';
import { SafeAppSocialProfile } from '@/domain/safe-apps/entities/safe-app-social-profile.entity';

export interface SafeApp {
  id: number;
  url: string;
  name: string;
  iconUrl: string;
  description: string;
  chainIds: number[];
  provider: SafeAppProvider | null;
  accessControl: SafeAppAccessControl;
  tags: string[];
  features: string[];
  developerWebsite: string | null;
  socialProfiles: SafeAppSocialProfile[];
}
