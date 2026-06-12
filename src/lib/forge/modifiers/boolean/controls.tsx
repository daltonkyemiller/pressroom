import { SegControl, ToggleControl } from "@/components/dither/controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ControlsComponent } from "../types";
import type { BooleanParams } from "./runtime";

export const BooleanControls: ControlsComponent<BooleanParams> = ({
  params,
  nodes,
  currentNodeId,
  onPatch,
}) => {
  const targets = nodes.filter((n) => n.id !== currentNodeId);
  return (
    <>
      <SegControl name="op" value={params.op}
        options={[
          { value: "union", label: "union" },
          { value: "subtract", label: "subtract" },
          { value: "intersect", label: "intersect" },
          { value: "exclude", label: "exclude" },
        ]}
        onChange={(v) => onPatch({ op: v })} />
      <div className="mb-2">
        <span className="mb-1.5 block text-xs tracking-wider text-muted-foreground uppercase">
          target node
        </span>
        <Select
          value={params.targetNodeId != null ? String(params.targetNodeId) : ""}
          onValueChange={(v) => onPatch({ targetNodeId: v ? Number(v) : null })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="— pick a node —" />
          </SelectTrigger>
          <SelectContent>
            {targets.map((n) => (
              <SelectItem key={n.id} value={String(n.id)}>
                #{n.id} · {n.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {targets.length === 0 && (
          <p className="mt-1 text-[11px] italic text-muted-foreground">
            add a second node to use as the boolean operand
          </p>
        )}
      </div>
      <ToggleControl name="hide target node" value={params.hideTarget}
        onChange={(v) => onPatch({ hideTarget: v })} />
    </>
  );
};
