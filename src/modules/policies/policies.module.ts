// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';

/**
 * Policies on a Safe: what restricts it, and what would.
 *
 * A policy reaches a Safe through one of three mechanisms - an enabled module,
 * the `SafePolicyGuard`, or an off-chain grant - and the wallet renders all three
 * in one list. This module holds the vocabulary they share; the state behind each
 * arrives from its own source in the PRs stacked on this one.
 *
 * No provider yet: this PR is type definitions and their derivations, so that
 * everything downstream can be built against the shape rather than against an
 * implementation.
 */
@Module({})
export class PoliciesModule {}
