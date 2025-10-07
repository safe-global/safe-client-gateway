import type { Severity } from '@/modules/safe-shield/entities/severity.entity';

export const BLOCKAID_SEVERITY_MAP: Record<string, keyof typeof Severity> = {
  Malicious: 'CRITICAL',
  Warning: 'WARN',
  Benign: 'OK',
  Info: 'INFO',
};
