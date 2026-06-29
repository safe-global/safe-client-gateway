// SPDX-License-Identifier: FSL-1.1-MIT

import { BillingServiceTokenSchema } from '@/modules/billing/domain/entities/billing-service-token.entity';

describe('BillingServiceTokenSchema', () => {
  const baseClaims = {
    iss: 'safe-client-gateway',
    sub: 'billing-service',
    aud: ['safe-client-gateway'],
  };

  it('accepts a token authorized via the SERVICE_ACCESS role', () => {
    const result = BillingServiceTokenSchema.safeParse({
      ...baseClaims,
      roles: ['SERVICE_ACCESS'],
    });

    expect(result.success).toBe(true);
  });

  it('accepts a token authorized via the data markers', () => {
    const result = BillingServiceTokenSchema.safeParse({
      ...baseClaims,
      data: {
        service_name: 'billing-service',
        permission_type: 'SERVICE_ACCESS',
        user_type: 'SERVICE_USER',
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts a token whose roles include SERVICE_ACCESS among others', () => {
    const result = BillingServiceTokenSchema.safeParse({
      ...baseClaims,
      roles: ['BILLING_ADMIN', 'SERVICE_ACCESS'],
    });

    expect(result.success).toBe(true);
  });

  it('rejects a token whose roles do not include SERVICE_ACCESS', () => {
    const result = BillingServiceTokenSchema.safeParse({
      ...baseClaims,
      roles: ['BILLING_ADMIN', 'SOME_OTHER_ROLE'],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a token with neither role nor data markers', () => {
    const result = BillingServiceTokenSchema.safeParse(baseClaims);

    expect(result.success).toBe(false);
  });

  it('rejects data markers with an empty service_name', () => {
    const result = BillingServiceTokenSchema.safeParse({
      ...baseClaims,
      data: {
        service_name: '',
        permission_type: 'SERVICE_ACCESS',
        user_type: 'SERVICE_USER',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects data markers with a non-service user_type', () => {
    const result = BillingServiceTokenSchema.safeParse({
      ...baseClaims,
      data: {
        service_name: 'billing-service',
        permission_type: 'SERVICE_ACCESS',
        user_type: 'HUMAN_USER',
      },
    });

    expect(result.success).toBe(false);
  });
});
