import { SliderControl } from "@/components/dither/controls";
import { LinkedSliders } from "@/components/forge/linked-sliders";
import type { ControlsComponent } from "../types";
import type { GridRepeatParams } from "./runtime";

export const GridRepeatControls: ControlsComponent<GridRepeatParams> = ({
  params,
  onPatch,
}) => (
  <>
    <LinkedSliders aName="count x" bName="count y"
      aValue={params.countX} bValue={params.countY}
      min={1} max={30}
      onChange={(countX, countY) =>
        onPatch({ countX: Math.round(countX), countY: Math.round(countY) })
      } />
    <LinkedSliders aName="spacing x" bName="spacing y"
      aValue={params.dx} bValue={params.dy}
      min={0} max={500} defaultLinked
      onChange={(dx, dy) => onPatch({ dx, dy })} />
    <SliderControl name="row stagger" min={-500} max={500} value={params.staggerY}
      onChange={(v) => onPatch({ staggerY: v })} />
    <SliderControl name="rotate / cell" min={-180} max={180} value={params.cellRotate} unit="°"
      onChange={(v) => onPatch({ cellRotate: v })} />
  </>
);
