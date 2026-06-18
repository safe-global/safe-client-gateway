// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';

export type GraphNode = { address: Address; isSpaceMember: boolean };
export type GraphEdge = { from: Address; to: Address };
export type NestedSafesGraph = {
  nodes: Array<GraphNode>;
  edges: Array<GraphEdge>;
  truncated: boolean;
  depthReached: number;
};

const lower = (a: Address): string => a.toLowerCase();

/**
 * Breadth-first traversal of nested-safe ownership for a single chain.
 *
 * - `fetchOwnedSafes(owner)` returns the Safes that have `owner` as a direct
 *   on-chain owner (i.e. one level down).
 * - `visited` (lowercased addresses) prevents re-expanding a node, so cycles
 *   terminate. Directed edges to already-seen nodes are still recorded so the
 *   cycle/fan-in is visible in the rendered graph.
 * - Stops at `maxDepth` levels or once `maxNodes` distinct nodes exist,
 *   flagging `truncated`.
 * - A rejected fetch degrades that node to a leaf (no children) instead of
 *   failing the whole graph.
 */
export async function buildNestedSafesGraph(args: {
  seeds: Array<Address>;
  memberSet: Set<string>;
  fetchOwnedSafes: (ownerAddress: Address) => Promise<Array<Address>>;
  maxDepth: number;
  maxNodes: number;
}): Promise<NestedSafesGraph> {
  const { seeds, memberSet, fetchOwnedSafes, maxDepth, maxNodes } = args;

  const nodes = new Map<string, GraphNode>();
  const edgeKeys = new Set<string>();
  const edges: Array<GraphEdge> = [];
  const visited = new Set<string>();
  let truncated = false;
  let depthReached = 0;

  const addNode = (address: Address): boolean => {
    const key = lower(address);
    if (nodes.has(key)) return true;
    if (nodes.size >= maxNodes) {
      truncated = true;
      return false;
    }
    nodes.set(key, { address, isSpaceMember: memberSet.has(key) });
    return true;
  };

  const addEdge = (from: Address, to: Address): void => {
    const key = `${lower(from)}|${lower(to)}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ from, to });
  };

  // Seed nodes (dedup, preserve checksummed form)
  let frontier: Array<Address> = [];
  for (const seed of seeds) {
    if (!nodes.has(lower(seed)) && addNode(seed)) {
      frontier.push(seed);
    }
  }

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (frontier.length === 0) break;
    for (const addr of frontier) {
      visited.add(lower(addr));
    }

    const results = await Promise.allSettled(
      frontier.map(async (owner) => ({
        owner,
        children: await fetchOwnedSafes(owner),
      })),
    );

    const next: Array<Address> = [];
    const queued = new Set<string>();
    for (const result of results) {
      if (result.status !== 'fulfilled') continue; // failed fetch → leaf node
      const { owner, children } = result.value;
      for (const child of children) {
        const added = addNode(child);
        if (!added) continue; // node cap hit; skip an edge to a node we won't render
        addEdge(owner, child);
        const childKey = lower(child);
        if (!(visited.has(childKey) || queued.has(childKey))) {
          queued.add(childKey);
          next.push(child);
        }
      }
    }

    depthReached = depth;
    frontier = next;
  }

  if (frontier.length > 0) {
    truncated = true; // more levels existed beyond maxDepth
  }

  return { nodes: [...nodes.values()], edges, truncated, depthReached };
}
