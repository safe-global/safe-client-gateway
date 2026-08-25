// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { nameBuilder } from '@/domain/common/entities/name.builder';

/**
 * The Workspace route matrices step-up is defined against, shared by every
 * spec that has to hold the gateway to them: `elevation.integration.spec.ts`
 * (what the enforcement flag gates) and
 * `step-up-flag-off-parity.integration.spec.ts` (that the flag off is
 * indistinguishable from the feature not being deployed at all).
 *
 * One list, imported twice, so that gating or un-gating a route stays a single
 * deliberate edit rather than two lists that can drift apart.
 */

export type Method = 'post' | 'put' | 'patch' | 'delete' | 'get';

export type Route = {
  name: string;
  method: Method;
  path: (spaceId: string) => string;
  body?: object;
};

/**
 * Every route that requires a fresh second factor, per Milestone 2 of the
 * Workspace 2FA plan.
 *
 * The line is drawn at what a stolen session could do to *other people*:
 * changing who has access to the Workspace, or changing state the whole
 * Workspace shares. Acting only on your own membership is not gated — see
 * {@link UNGATED_ROUTES}.
 *
 * Guards run before validation pipes, so the request bodies here only need to
 * exist — the assertions are about the elevation contract, not about each
 * route's own success path, which its own controller spec covers.
 */
export const GATED_ROUTES: Array<Route> = [
  {
    name: 'POST /v1/spaces/:spaceId/members/invite',
    method: 'post',
    path: (id) => `/v1/spaces/${id}/members/invite`,
    body: { users: [] },
  },
  {
    name: 'PATCH /v1/spaces/:spaceId/members/:userId/role',
    method: 'patch',
    path: (id) => `/v1/spaces/${id}/members/1/role`,
    body: { role: 'MEMBER' },
  },
  {
    name: 'DELETE /v1/spaces/:spaceId/members/:userId',
    method: 'delete',
    path: (id) => `/v1/spaces/${id}/members/1`,
  },
  {
    name: 'PATCH /v1/spaces/:id',
    method: 'patch',
    path: (id) => `/v1/spaces/${id}`,
    body: { name: nameBuilder() },
  },
  {
    name: 'DELETE /v1/spaces/:id',
    method: 'delete',
    path: (id) => `/v1/spaces/${id}`,
  },
  {
    name: 'POST /v1/spaces/:spaceId/safes',
    method: 'post',
    path: (id) => `/v1/spaces/${id}/safes`,
    body: { safes: [] },
  },
  {
    name: 'DELETE /v1/spaces/:spaceId/safes',
    method: 'delete',
    path: (id) => `/v1/spaces/${id}/safes`,
    body: { safes: [] },
  },
  {
    name: 'PUT /v1/spaces/:spaceId/address-book',
    method: 'put',
    path: (id) => `/v1/spaces/${id}/address-book`,
    body: { items: [] },
  },
  {
    name: 'DELETE /v1/spaces/:spaceId/address-book/:address',
    method: 'delete',
    path: (id) =>
      `/v1/spaces/${id}/address-book/${getAddress(faker.finance.ethereumAddress())}`,
  },
  {
    name: 'PUT /v1/spaces/:spaceId/address-book/requests/:requestId/approve',
    method: 'put',
    path: (id) => `/v1/spaces/${id}/address-book/requests/1/approve`,
  },
];

/**
 * Routes deliberately left ungated. Pinned here so that gating or un-gating a
 * Workspace route is always a conscious edit to this list, never a silent
 * side effect of touching a controller.
 *
 * Most of these only read, or only change the caller's own membership: an
 * attacker holding a stolen session gains nothing from them that the session
 * did not already grant, so a challenge would cost every legitimate user a
 * prompt to buy nothing. The entries where that reasoning does not apply
 * carry their own justification below.
 */
export const UNGATED_ROUTES: Array<Route> = [
  // Creating a Workspace has no prior state to tamper with — the caller is the
  // only member of what they just made — and gating it would put a challenge
  // in the middle of onboarding. Listed rather than omitted so that gating it
  // later is a deliberate edit, like every other row here.
  {
    name: 'POST /v1/spaces',
    method: 'post',
    path: () => '/v1/spaces',
    body: { name: nameBuilder() },
  },
  {
    name: 'GET /v1/spaces/:id',
    method: 'get',
    path: (id) => `/v1/spaces/${id}`,
  },
  {
    name: 'GET /v1/spaces/:spaceId/members',
    method: 'get',
    path: (id) => `/v1/spaces/${id}/members`,
  },
  {
    name: 'GET /v1/spaces/:spaceId/safes',
    method: 'get',
    path: (id) => `/v1/spaces/${id}/safes`,
  },
  {
    name: 'GET /v1/spaces/:spaceId/address-book',
    method: 'get',
    path: (id) => `/v1/spaces/${id}/address-book`,
  },
  {
    name: 'GET /v1/spaces/:spaceId/address-book/requests',
    method: 'get',
    path: (id) => `/v1/spaces/${id}/address-book/requests`,
  },
  {
    name: 'PATCH /v1/spaces/:spaceId/members/alias',
    method: 'patch',
    path: (id) => `/v1/spaces/${id}/members/alias`,
    body: { alias: nameBuilder() },
  },
  // Responding to an invitation someone else already sent, and leaving of
  // your own accord, only move the caller in or out of the Workspace. The
  // invite itself is gated, which is where the access decision is made.
  {
    name: 'POST /v1/spaces/:spaceId/members/accept',
    method: 'post',
    path: (id) => `/v1/spaces/${id}/members/accept`,
    body: {},
  },
  {
    name: 'POST /v1/spaces/:spaceId/members/decline',
    method: 'post',
    path: (id) => `/v1/spaces/${id}/members/decline`,
    body: {},
  },
  {
    name: 'DELETE /v1/spaces/:spaceId/members (self-removal)',
    method: 'delete',
    path: (id) => `/v1/spaces/${id}/members`,
  },
  // The one admin action on another user here. It re-sends an invitation a
  // gated `members/invite` call already created: it grants no access, changes
  // no role, and cannot reach anyone who was not already invited. The worst an
  // attacker gets is repeat mail to an address an admin already chose to
  // invite, so the cost of a challenge outweighs it.
  {
    name: 'POST /v1/spaces/:spaceId/members/:userId/invite/renew',
    method: 'post',
    path: (id) => `/v1/spaces/${id}/members/1/invite/renew`,
  },
  {
    name: 'POST /v1/spaces/:spaceId/address-book/requests (propose contact)',
    method: 'post',
    path: (id) => `/v1/spaces/${id}/address-book/requests`,
    body: {},
  },
  {
    name: 'PUT /v1/spaces/:spaceId/address-book/requests/:requestId/reject',
    method: 'put',
    path: (id) => `/v1/spaces/${id}/address-book/requests/1/reject`,
  },
];
