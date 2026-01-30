import { deploymentBuilder } from '@/modules/staking/datasources/entities/__tests__/deployment.entity.builder';
import { DeploymentSchema } from '@/modules/staking/datasources/entities/deployment.entity';
import { faker } from '@faker-js/faker';
import type { Address } from 'viem';
import { getAddress } from 'viem';

describe('DeploymentSchema', () => {
  it('should validate a Deployment object', () => {
    const deployment = deploymentBuilder().build();

    const result = DeploymentSchema.safeParse(deployment);

    expect(result.success).toBe(true);
  });

  it.each(['id' as const, 'organization_id' as const])(
    `should not validate non-UUID %s values`,
    (key) => {
      const deployment = deploymentBuilder()
        .with(key, faker.string.numeric())
        .build();

      const result = DeploymentSchema.safeParse(deployment);

      expect(!result.success && result.error.issues).toEqual([
        expect.objectContaining({
          code: 'invalid_format',
          format: 'uuid',
          message: 'Invalid UUID',
          origin: 'string',
          path: [key],
        }),
      ]);
    },
  );

  it.each(['product_type' as const, 'chain' as const, 'status' as const])(
    `should not default non-enum %s values to unknown`,
    (key) => {
      const deployment = deploymentBuilder()
        .with(key, faker.string.alpha() as 'unknown')
        .build();

      const result = DeploymentSchema.safeParse(deployment);

      expect(result.success && result.data[key]).toBe('unknown');
    },
  );

  it('should not validate numeric string chain_id values', () => {
    const deployment = deploymentBuilder()
      .with('chain_id', faker.string.numeric() as unknown as number)
      .build();

    const result = DeploymentSchema.safeParse(deployment);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Invalid input: expected number, received string',
        path: ['chain_id'],
      },
    ]);
  });

  it('should checksum the address field', () => {
    const nonChecksummedAddress = faker.finance.ethereumAddress().toLowerCase();
    const deployment = deploymentBuilder()
      .with('address', nonChecksummedAddress as Address)
      .build();

    const result = DeploymentSchema.safeParse(deployment);

    expect(result.success && result.data.address).toStrictEqual(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should default external_links to null', () => {
    const deployment = deploymentBuilder().build();
    // @ts-expect-error - inferred type does not allow undefined
    delete deployment.external_links;
    const result = DeploymentSchema.safeParse(deployment);
    expect(result.success && result.data.external_links).toBe(null);
  });

  it('should default external_links.deposit_url to null', () => {
    const deployment = deploymentBuilder().build();
    // @ts-expect-error - inferred type does not allow undefined
    delete deployment.external_links?.deposit_url;

    const result = DeploymentSchema.safeParse(deployment);

    expect(result.success && result.data.external_links?.deposit_url).toBe(
      null,
    );
  });

  it('should not allow a non-URL external_links.deposit_url', () => {
    const deployment = deploymentBuilder()
      .with('external_links', {
        deposit_url: faker.string.numeric(),
      })
      .build();

    const result = DeploymentSchema.safeParse(deployment);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_format',
        format: 'url',
        message: 'Invalid URL',
        path: ['external_links', 'deposit_url'],
      },
    ]);
  });

  it.each([
    'id' as const,
    'organization_id' as const,
    'name' as const,
    'display_name' as const,
    'description' as const,
    'chain_id' as const,
    'address' as const,
  ])('should not validate missing %s field', (key) => {
    const deployment = deploymentBuilder().build();
    delete deployment[key];

    const result = DeploymentSchema.safeParse(deployment);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0].path[0]).toBe(key);
  });

  it('should not validate an invalid Deployment object', () => {
    const deployment = {
      invalid: 'deployment',
    };

    const result = DeploymentSchema.safeParse(deployment);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['id'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['organization_id'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['name'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['display_name'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['description'],
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Invalid input: expected number, received undefined',
        path: ['chain_id'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['address'],
      },
    ]);
  });
});
