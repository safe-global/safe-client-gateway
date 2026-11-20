// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { registerDeviceDtoBuilder } from '#/modules/notifications/routes/v1/entities/__tests__/register-device.dto.builder';
import {
  type RegisterDeviceDto,
  RegisterDeviceDtoSchema,
} from '#/modules/notifications/routes/v1/entities/register-device.dto.entity';
import { fakeUuid } from '#/validation/entities/schemas/__tests__/uuid.builder';

describe('RegisterDeviceDtoSchema', () => {
  const buildDto = async (): Promise<RegisterDeviceDto> => {
    const builder = await registerDeviceDtoBuilder({
      uuid: fakeUuid(),
      cloudMessagingToken: fakeUuid(),
      timestamp: Math.floor(Date.now() / 1000),
    });
    return builder
      .with('safeRegistrations', [
        {
          chainId: faker.string.numeric({ length: { min: 1, max: 6 } }),
          safes: [getAddress(faker.finance.ethereumAddress())],
          signatures: [faker.string.hexadecimal({ length: 130 })],
        },
      ])
      .build();
  };

  const issuePaths = (value: unknown): Array<Array<PropertyKey>> => {
    const result = RegisterDeviceDtoSchema.safeParse(value);
    return result.success ? [] : result.error.issues.map(({ path }) => path);
  };

  it('should validate a valid RegisterDeviceDto', async () => {
    const dto = await buildDto();

    expect(RegisterDeviceDtoSchema.safeParse(dto).success).toBe(true);
  });

  it.each(['uuid', 'timestamp', 'buildNumber', 'bundle', 'version'])(
    'should allow %s to be omitted',
    async (field) => {
      const dto = await buildDto();

      expect(issuePaths({ ...dto, [field]: undefined })).toStrictEqual([]);
    },
  );

  it.each(['uuid', 'timestamp'])(
    'should allow %s to be null',
    async (field) => {
      const dto = await buildDto();

      expect(issuePaths({ ...dto, [field]: null })).toStrictEqual([]);
    },
  );

  it.each(['cloudMessagingToken', 'deviceType', 'safeRegistrations'])(
    'should require %s',
    async (field) => {
      const dto = await buildDto();

      expect(issuePaths({ ...dto, [field]: undefined })).toStrictEqual([
        [field],
      ]);
    },
  );

  it.each([
    ['deviceType', faker.word.noun().toUpperCase()],
    ['uuid', faker.string.alphanumeric(10)],
    ['timestamp', faker.word.noun()],
    ['timestamp', `0x${faker.string.hexadecimal({ length: 8, prefix: '' })}`],
    ['timestamp', ''],
    ['timestamp', 'Infinity'],
    ['timestamp', `${faker.number.int({ max: 1e9 })}.5`],
  ])('should reject an invalid %s (%s)', async (field, value) => {
    const dto = await buildDto();

    expect(issuePaths({ ...dto, [field]: value })).toStrictEqual([[field]]);
  });

  it.each(['chainId', 'safes', 'signatures'])(
    'should require %s in a safe registration',
    async (field) => {
      const dto = await buildDto();

      expect(
        issuePaths({
          ...dto,
          safeRegistrations: [
            { ...dto.safeRegistrations[0], [field]: undefined },
          ],
        }),
      ).toStrictEqual([['safeRegistrations', 0, field]]);
    },
  );

  it('should reject a non-numeric chainId', async () => {
    const dto = await buildDto();

    expect(
      issuePaths({
        ...dto,
        safeRegistrations: [
          { ...dto.safeRegistrations[0], chainId: faker.word.noun() },
        ],
      }),
    ).toStrictEqual([['safeRegistrations', 0, 'chainId']]);
  });

  it('should reject a safe that is not an address', async () => {
    const dto = await buildDto();
    const result = RegisterDeviceDtoSchema.safeParse({
      ...dto,
      safeRegistrations: [
        {
          ...dto.safeRegistrations[0],
          safes: [faker.string.hexadecimal({ length: 10 })],
        },
      ],
    });

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid address',
        path: ['safeRegistrations', 0, 'safes', 0],
      },
    ]);
  });

  it('should keep a lowercase safe address as sent', async () => {
    const dto = await buildDto();
    const safe = faker.finance.ethereumAddress().toLowerCase();

    const result = RegisterDeviceDtoSchema.safeParse({
      ...dto,
      safeRegistrations: [{ ...dto.safeRegistrations[0], safes: [safe] }],
    });

    expect(result.success && result.data.safeRegistrations[0].safes).toEqual([
      safe,
    ]);
  });

  it.each([[[]], [['']]])(
    'should accept unsigned registrations (signatures: %j)',
    async (signatures) => {
      const dto = await buildDto();

      expect(
        issuePaths({
          ...dto,
          safeRegistrations: [{ ...dto.safeRegistrations[0], signatures }],
        }),
      ).toStrictEqual([]);
    },
  );
});
