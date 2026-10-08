// SPDX-License-Identifier: FSL-1.1-MIT
import type { SpaceSafe } from '@/modules/spaces/domain/safes/entities/space-safe.entity';

export type SafeRef = Pick<SpaceSafe, 'chainId' | 'address'>;
