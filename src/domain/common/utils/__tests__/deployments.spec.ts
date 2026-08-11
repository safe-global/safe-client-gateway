// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAllowanceModuleDeployments } from '@/domain/common/utils/deployments';

describe('getAllowanceModuleDeployments', () => {
  it('should return the checksummed AllowanceModule address of a chain', () => {
    // Sepolia, @safe-global/safe-modules-deployments v0.1.0
    expect(
      getAllowanceModuleDeployments({ chainId: '11155111' }),
    ).toStrictEqual(['0xCFbFaC74C26F8647cBDb8c5caf80BB5b32E43134']);
  });

  it('should return an empty array for a chain without a deployment', () => {
    expect(
      getAllowanceModuleDeployments({
        chainId: faker.string.numeric({ length: 18 }),
      }),
    ).toStrictEqual([]);
  });
});
