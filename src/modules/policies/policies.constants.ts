// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * DI token for the registered {@link PolicyResolver}s.
 *
 * Injected as a list so a new policy type is added by registering a resolver in
 * `PoliciesModule`, without touching `PoliciesService`.
 */
export const POLICY_RESOLVERS = Symbol('POLICY_RESOLVERS');
