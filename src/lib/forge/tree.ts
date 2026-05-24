// Tree helpers for the recursive Node forest. Top-level state in the doc is
// `nodes: Node[]`, where each node is either a primitive (leaf) or a group
// (which has its own children: Node[]). Every mutation has to walk the
// tree, so these helpers keep the actions in forge-app readable.

import type { Node } from "./types";

// Find a node by id anywhere in the tree.
export function findNode(nodes: readonly Node[], id: number): Node | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.kind === "group") {
      const inner = findNode(n.children, id);
      if (inner) return inner;
    }
  }
  return undefined;
}

// Find a node AND its parent (or null if at the top level).
export function findWithParent(
  nodes: readonly Node[],
  id: number,
  parent: Node | null = null,
): { node: Node; parent: Node | null } | undefined {
  for (const n of nodes) {
    if (n.id === id) return { node: n, parent };
    if (n.kind === "group") {
      const r = findWithParent(n.children, id, n);
      if (r) return r;
    }
  }
  return undefined;
}

// Recursive map: return a new tree where the node with `id` is transformed
// by `fn`. If `fn` returns null, the node is removed. Identity returns for
// untouched branches keep React's reconciliation cheap.
export function mapNode(
  nodes: readonly Node[],
  id: number,
  fn: (n: Node) => Node | null,
): Node[] {
  let mutated = false;
  const out: Node[] = [];
  for (const n of nodes) {
    if (n.id === id) {
      const next = fn(n);
      if (next !== null) out.push(next);
      mutated = true;
      continue;
    }
    if (n.kind === "group") {
      const newChildren = mapNode(n.children, id, fn);
      if (newChildren !== n.children) {
        out.push({ ...n, children: newChildren });
        mutated = true;
        continue;
      }
    }
    out.push(n);
  }
  return mutated ? out : (nodes as Node[]);
}

// Remove a node from the tree (returns new tree).
export function removeNodeById(nodes: readonly Node[], id: number): Node[] {
  return mapNode(nodes, id, () => null);
}

// Insert `child` into a group identified by `groupId` (as the first child
// so the new addition shows up at the top of the group's section in the
// sidebar — same convention as top-level prepend).
export function insertIntoGroup(
  nodes: readonly Node[],
  groupId: number,
  child: Node,
): Node[] {
  return mapNode(nodes, groupId, (n) => {
    if (n.kind !== "group") return n;
    return { ...n, children: [child, ...n.children] };
  });
}

// Flat depth-first iteration — useful for things like "list all primitive
// IDs" or "count nodes".
export function* iterNodes(nodes: readonly Node[]): Generator<Node> {
  for (const n of nodes) {
    yield n;
    if (n.kind === "group") yield* iterNodes(n.children);
  }
}

// Insert `newNode` immediately before the existing node with `siblingId`,
// in whatever level (top-level or inside a group) the sibling lives.
export function insertSiblingBefore(
  nodes: readonly Node[],
  siblingId: number,
  newNode: Node,
): Node[] {
  const idx = nodes.findIndex((n) => n.id === siblingId);
  if (idx >= 0) {
    const out = [...nodes];
    out.splice(idx, 0, newNode);
    return out;
  }
  // Not at this level — recurse into groups.
  let mutated = false;
  const out: Node[] = [];
  for (const n of nodes) {
    if (n.kind === "group") {
      const next = insertSiblingBefore(n.children, siblingId, newNode);
      if (next !== n.children) {
        out.push({ ...n, children: next });
        mutated = true;
        continue;
      }
    }
    out.push(n);
  }
  return mutated ? out : (nodes as Node[]);
}

// Same as insertSiblingBefore but places the new node AFTER the target.
export function insertSiblingAfter(
  nodes: readonly Node[],
  siblingId: number,
  newNode: Node,
): Node[] {
  const idx = nodes.findIndex((n) => n.id === siblingId);
  if (idx >= 0) {
    const out = [...nodes];
    out.splice(idx + 1, 0, newNode);
    return out;
  }
  let mutated = false;
  const out: Node[] = [];
  for (const n of nodes) {
    if (n.kind === "group") {
      const next = insertSiblingAfter(n.children, siblingId, newNode);
      if (next !== n.children) {
        out.push({ ...n, children: next });
        mutated = true;
        continue;
      }
    }
    out.push(n);
  }
  return mutated ? out : (nodes as Node[]);
}

// Deep-clone a node tree, assigning fresh ids to the node, every child,
// and every modifier. Used by the duplicate action.
export function deepCloneWithFreshIds(
  node: Node,
  nextNodeId: () => number,
  nextModId: () => number,
): Node {
  const cloned = structuredClone(node);
  function reid(n: Node) {
    n.id = nextNodeId();
    for (const m of n.modifiers) m.id = nextModId();
    if (n.kind === "group") for (const c of n.children) reid(c);
  }
  reid(cloned);
  return cloned;
}
