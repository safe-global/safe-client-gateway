import { deploymentBuilder } from '@/datasources/staking-api/entities/__tests__/deployment.entity.builder';
import { DeploymentSchema } from '@/datasources/staking-api/entities/deployment.entity';
import { faker } from '@faker-js/faker';
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

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'invalid_string',
        message: 'Invalid uuid',
        path: [key],
        validation: 'uuid',
      });
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

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'invalid_type',
      expected: 'number',
      message: 'Expected number, received string',
      path: ['chain_id'],
      received: 'string',
    });
  });

  it('should checksum the address field', () => {
    const nonChecksummedAddress = faker.finance.ethereumAddress().toLowerCase();
    const deployment = deploymentBuilder()
      .with('address', nonChecksummedAddress as `0x${string}`)
      .build();

    const result = DeploymentSchema.safeParse(deployment);

    expect(result.success && result.data.address).toStrictEqual(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should allow numeric string product_fee values', () => {
    const deployment = deploymentBuilder()
      .with('product_fee', faker.string.numeric())
      .build();

    const result = DeploymentSchema.safeParse(deployment);

    expect(result.success && result.data.product_fee).toBe(
      deployment.product_fee,
    );
  });

  it('should not allow numeric product_fee values', () => {
    const deployment = deploymentBuilder()
      .with('product_fee', faker.number.float() as unknown as string)
      .build();

    const result = DeploymentSchema.safeParse(deployment);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'invalid_type',
      expected: 'string',
      message: 'Expected string, received number',
      path: ['product_fee'],
      received: 'number',
    });
  });

  it.each(['product_fee' as const, 'external_links' as const])(
    'should default %s to null',
    (key) => {
      const deployment = deploymentBuilder().build();
      delete deployment[key];
      const result = DeploymentSchema.safeParse(deployment);
      expect(result.success && result.data[key]).toBe(null);
    },
  );

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

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'invalid_string',
      message: 'Invalid url',
      path: ['external_links', 'deposit_url'],
      validation: 'url',
    });
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
        message: 'Required',
        path: ['id'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['organization_id'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['name'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['display_name'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['description'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['chain_id'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['address'],
        received: 'undefined',
      },
    ]);
  });
});
