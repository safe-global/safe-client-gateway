import { SafeAppAccessControl } from './safe-app-access-control.entity';
import { SafeAppProvider } from './safe-app-provider.entity';

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
}
