import { SliderControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { PolygonParams } from "./runtime";

export const PolygonControls: ControlsComponent<PolygonParams> = ({ params, onPatch }) => (
  <>
    <SliderControl name="center x" min={-2000} max={2000} value={params.cx}
      onChange={(v) => onPatch({ cx: v })} />
    <SliderControl name="center y" min={-2000} max={2000} value={params.cy}
      onChange={(v) => onPatch({ cy: v })} />
    <SliderControl name="radius" min={0} max={2000} value={params.radius}
      onChange={(v) => onPatch({ radius: v })} />
    <SliderControl name="sides" min={3} max={24} value={params.sides}
      onChange={(v) => onPatch({ sides: v })} />
    <SliderControl name="star inner" min={0} max={1} step={0.02} value={params.starInner}
      onChange={(v) => onPatch({ starInner: v })} />
    <SliderControl name="rotation" min={0} max={360} value={params.rotation} unit="°"
      onChange={(v) => onPatch({ rotation: v })} />
  </>
);
