// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';

// Seed faker per test file so a failing run's data can be reproduced: the seed
// is printed, and re-running with FAKER_SEED=<n> reproduces the exact values.
const seed = process.env.FAKER_SEED
  ? Number(process.env.FAKER_SEED)
  : faker.seed();

faker.seed(seed);

console.info(`[faker] seed=${seed}`);
