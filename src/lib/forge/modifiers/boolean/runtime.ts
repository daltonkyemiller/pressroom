import type { ModifierModule } from "../types";
import type { Instance } from "../../engine";
import { computeBooleanPath, instancesToSvgFragment } from "../../boolean";

export type BooleanParams = {
  op: "union" | "subtract" | "intersect" | "exclude";
  targetNodeId: number | null; // when null, the modifier is a no-op
  // When true (default), the target node is skipped during the doc render
  // so its geometry only appears via the boolean result. Otherwise the
  // target would draw on top of the boolean output and visually mask the
  // effect — e.g. subtracting a small circle from a bigger one produces a
  // ring, but the small circle redrawing on top fills the ring's hole.
  hideTarget: boolean;
};

export const boolean: ModifierModule<"boolean", BooleanParams> = {
  kind: "boolean",
  label: "Boolean",
  defaults: () => ({ op: "subtract", targetNodeId: null, hideTarget: true }),
  apply(instances, params, ctx) {
    if (params.targetNodeId == null) return instances;
    const target = ctx.allNodes.find((n) => n.id === params.targetNodeId);
    if (!target || target.id === ctx.node.id) return instances;
    // A = this node's primitive applied through every instance accumulated
    //     so far in this stack.
    // B = the target node's full expansion (all of its own modifiers).
    const targetExpanded = ctx.expandNode(target, ctx.allNodes);
    const selfSvg = instancesToSvgFragment(instances);
    const targetSvg = instancesToSvgFragment(targetExpanded.instances);
    const d = computeBooleanPath(selfSvg, targetSvg, params.op);
    if (!d) return instances;
    // Collapse to a single identity-transform instance so subsequent
    // modifiers operate on the boolean output. Inherit style from the
    // first existing instance.
    const first = instances[0];
    const fallback: Instance["primitive"] = ctx.node.kind === "primitive"
      ? ctx.node.primitive
      : { kind: "rect", params: { cx: 0, cy: 0, w: 0, h: 0, rx: 0 } };
    return [
      {
        primitive: first?.primitive ?? fallback,
        transform: "",
        fill: first?.fill ?? "#000000",
        stroke: first?.stroke ?? "none",
        strokeWidth: first?.strokeWidth ?? 0,
        opacity: first?.opacity ?? 1,
        pathOverride: d,
      },
    ];
  },
};
