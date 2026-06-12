import { CurvesEditor } from "@/components/dither/curves-editor";
import type { ControlsComponent } from "../types";
import type { CurvesParams } from "../../curves";

export const CurvesControls: ControlsComponent<CurvesParams> = ({
  params,
  onPatch,
  onStart,
  onCommit,
}) => (
  <CurvesEditor
    value={params}
    onChange={(next) => onPatch(next as unknown as Record<string, unknown>)}
    onInteractStart={onStart}
    onInteractEnd={onCommit}
  />
);
