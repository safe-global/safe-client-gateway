// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import { buildNestedSafesGraph } from '@/modules/spaces/domain/nested-safes-graph.builder';

const addr = (): Address => getAddress(faker.finance.ethereumAddress());
const lower = (a: Address): string => a.toLowerCase();

describe('buildNestedSafesGraph', () => {
  it('expands a simple two-level tree from one seed', async () => {
    const a = addr();
    const b = addr();
    const c = addr();
    const owned: Record<string, Array<Address>> = {
      [lower(a)]: [b],
      [lower(b)]: [c],
      [lower(c)]: [],
    };

    const graph = await buildNestedSafesGraph({
      seeds: [a],
      memberSet: new Set([lower(a)]),
      fetchOwnedSafes: (owner) => Promise.resolve(owned[lower(owner)] ?? []),
      maxDepth: 6,
      maxNodes: 200,
    });

    expect(graph.nodes.map((n) => lower(n.address)).sort()).toEqual(
      [lower(a), lower(b), lower(c)].sort(),
    );
    expect(graph.edges).toEqual([
      { from: a, to: b },
      { from: b, to: c },
    ]);
    expect(
      graph.nodes.find((n) => lower(n.address) === lower(a))?.isSpaceMember,
    ).toBe(true);
    expect(
      graph.nodes.find((n) => lower(n.address) === lower(b))?.isSpaceMember,
    ).toBe(false);
    expect(graph.truncated).toBe(false);
  });

  it('terminates on a cycle (A owns B, B owns A) without infinite recursion', async () => {
    const a = addr();
    const b = addr();
    const owned: Record<string, Array<Address>> = {
      [lower(a)]: [b],
      [lower(b)]: [a],
    };

    const graph = await buildNestedSafesGraph({
      seeds: [a],
      memberSet: new Set([lower(a)]),
      fetchOwnedSafes: (owner) => Promise.resolve(owned[lower(owner)] ?? []),
      maxDepth: 6,
      maxNodes: 200,
    });

    expect(graph.nodes).toHaveLength(2);
    // both directed edges are kept so the cycle is visible
    expect(graph.edges).toContainEqual({ from: a, to: b });
    expect(graph.edges).toContainEqual({ from: b, to: a });
  });

  it('marks truncated and stops expanding when maxNodes is reached', async () => {
    const root = addr();
    const children = Array.from({ length: 10 }, () => addr());
    const owned: Record<string, Array<Address>> = { [lower(root)]: children };
    for (const c of children) {
      owned[lower(c)] = [];
    }

    const graph = await buildNestedSafesGraph({
      seeds: [root],
      memberSet: new Set([lower(root)]),
      fetchOwnedSafes: (owner) => Promise.resolve(owned[lower(owner)] ?? []),
      maxDepth: 6,
      maxNodes: 5,
    });

    expect(graph.truncated).toBe(true);
    expect(graph.nodes.length).toBeLessThanOrEqual(5);
  });

  it('marks truncated when depth exceeds maxDepth', async () => {
    const chain = Array.from({ length: 5 }, () => addr());
    const owned: Record<string, Array<Address>> = {};
    for (let i = 0; i < chain.length; i++) {
      owned[lower(chain[i])] = i < chain.length - 1 ? [chain[i + 1]] : [];
    }

    const graph = await buildNestedSafesGraph({
      seeds: [chain[0]],
      memberSet: new Set([lower(chain[0])]),
      fetchOwnedSafes: (owner) => Promise.resolve(owned[lower(owner)] ?? []),
      maxDepth: 2,
      maxNodes: 200,
    });

    expect(graph.truncated).toBe(true);
    expect(graph.depthReached).toBe(2);
  });

  it('degrades a failed fetch to a leaf node without failing the whole graph', async () => {
    const a = addr();
    const b = addr();
    const owned: Record<string, Array<Address>> = { [lower(a)]: [b] };

    const graph = await buildNestedSafesGraph({
      seeds: [a],
      memberSet: new Set([lower(a)]),
      fetchOwnedSafes: (owner) =>
        lower(owner) === lower(b)
          ? Promise.reject(new Error('TS down'))
          : Promise.resolve(owned[lower(owner)] ?? []),
      maxDepth: 6,
      maxNodes: 200,
    });

    expect(graph.nodes.map((n) => lower(n.address)).sort()).toEqual(
      [lower(a), lower(b)].sort(),
    );
    expect(graph.edges).toEqual([{ from: a, to: b }]);
  });

  it('handles multiple seeds and a shared (fan-in) child without duplicate edges', async () => {
    const a = addr();
    const x = addr();
    const shared = addr();
    const owned: Record<string, Array<Address>> = {
      [lower(a)]: [shared],
      [lower(x)]: [shared],
      [lower(shared)]: [],
    };

    const graph = await buildNestedSafesGraph({
      seeds: [a, x],
      memberSet: new Set([lower(a), lower(x)]),
      fetchOwnedSafes: (owner) => Promise.resolve(owned[lower(owner)] ?? []),
      maxDepth: 6,
      maxNodes: 200,
    });

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toContainEqual({ from: a, to: shared });
    expect(graph.edges).toContainEqual({ from: x, to: shared });
    // shared node appears once
    expect(
      graph.nodes.filter((n) => lower(n.address) === lower(shared)),
    ).toHaveLength(1);
  });
});
