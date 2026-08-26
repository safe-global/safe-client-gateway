// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * The registered {@link PolicyAssembler}s.
 *
 * Injected as one array so the route service never names a policy type:
 * supporting a new one is an assembler plus an entry in this provider.
 */
export const POLICY_ASSEMBLERS = Symbol('POLICY_ASSEMBLERS');
