import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export enum StakeState {
  Unknown = 'unknown',
  Unstaked = 'unstaked',
  PendingQueued = 'pending_queued',
  DepositInProgress = 'deposit_in_progress',
  PendingInitialized = 'pending_initialized',
  ActiveOngoing = 'active_ongoing',
  ExitRequested = 'exit_requested',
  ActiveExiting = 'active_exiting',
  ExitedUnslashed = 'exited_unslashed',
  WithdrawalPossible = 'withdrawal_possible',
  WithdrawalDone = 'withdrawal_done',
  ActiveSlashed = 'active_slashed',
  ExitedSlashed = 'exited_slashed',
}

export const StakeSchema = z.object({
  validator_address: HexSchema.refine((value) => value.length === 98),
  state: z.nativeEnum(StakeState).catch(StakeState.Unknown),
  rewards: NumericStringSchema,
  // Only returned if onchain_v1_include_net_rewards query is true
  net_claimable_consensus_rewards: NumericStringSchema.nullish().default(null),
});

export const StakesSchema = z.array(StakeSchema);

export type Stake = z.infer<typeof StakeSchema>;
