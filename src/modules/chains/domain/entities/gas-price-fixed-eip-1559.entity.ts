import type { z } from 'zod';
import type { GasPriceFixedEip1559Schema } from '@/modules/chains/domain/entities/schemas/chain.schema';

export type GasPriceFixedEIP1559 = z.infer<typeof GasPriceFixedEip1559Schema>;
