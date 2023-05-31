export enum SafeAppAccessControlPolicies {
  NoRestrictions = 'NO_RESTRICTIONS',
  DomainAllowlist = 'DOMAIN_ALLOWLIST',
  Unknown = 'UNKNOWN',
}

export interface SafeAppAccessControl {
  type: string;
  value: string[] | null;
}
