import { Fragment } from "react";
import { barStackBars, expandNode, type ClipDef } from "./engine";
import type { Doc, Node, Primitive } from "./types";

// Renders a single primitive shape (not modifier-expanded). The fill/stroke
// come from the node so the same primitive can render with different style.
function renderPrimitive(primitive: Primitive, nodeKey: string) {
  switch (primitive.kind) {
    case "rect": {
      const p = primitive.params;
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} />;
    }
    case "ellipse": {
      const p = primitive.params;
      return <ellipse cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} />;
    }
    case "barStack": {
      const bars = barStackBars(primitive.params);
      return (
        <g
          transform={
            primitive.params.rotation
              ? `rotate(${primitive.params.rotation} ${primitive.params.cx} ${primitive.params.cy})`
              : undefined
          }
        >
          {bars.map((b, i) => (
            <rect key={`${nodeKey}-bar-${i}`} x={b.x} y={b.y} width={b.w} height={b.h} />
          ))}
        </g>
      );
    }
  }
}

function ClipPathDef({ def }: { def: ClipDef }) {
  // SVG clip-path: only what's INSIDE the shape passes. For invert mode we
  // construct an even-odd compound path of (full canvas) - (clip shape).
  if (def.invert) {
    return (
      <clipPath id={def.id} clipPathUnits="userSpaceOnUse">
        <path
          d={
            def.shape === "ellipse"
              ? `M0,0 H100000 V100000 H0 Z M${def.cx - def.w / 2},${def.cy} a${def.w / 2},${def.h / 2} 0 1,0 ${def.w},0 a${def.w / 2},${def.h / 2} 0 1,0 ${-def.w},0 Z`
              : `M0,0 H100000 V100000 H0 Z M${def.cx - def.w / 2},${def.cy - def.h / 2} h${def.w} v${def.h} h${-def.w} Z`
          }
          fillRule="evenodd"
        />
      </clipPath>
    );
  }
  return (
    <clipPath id={def.id} clipPathUnits="userSpaceOnUse">
      {def.shape === "ellipse" ? (
        <ellipse cx={def.cx} cy={def.cy} rx={def.w / 2} ry={def.h / 2} />
      ) : (
        <rect x={def.cx - def.w / 2} y={def.cy - def.h / 2} width={def.w} height={def.h} />
      )}
    </clipPath>
  );
}

function NodeContent({ node }: { node: Node }) {
  const { instances, clipDefs } = expandNode(node);
  const style = {
    fill: node.fill,
    stroke: node.stroke,
    strokeWidth: node.strokeWidth || undefined,
    opacity: node.opacity,
  };
  return (
    <Fragment>
      {clipDefs.length > 0 && (
        <defs>
          {clipDefs.map((d) => (
            <ClipPathDef key={d.id} def={d} />
          ))}
        </defs>
      )}
      <g style={style}>
        {instances.map((inst, i) => (
          <g
            key={i}
            transform={inst.transform || undefined}
            clipPath={inst.clipPathId ? `url(#${inst.clipPathId})` : undefined}
          >
            {renderPrimitive(node.primitive, `${node.id}-${i}`)}
          </g>
        ))}
      </g>
    </Fragment>
  );
}

export function DocSvg({
  doc,
  selectedNodeId,
  onSelectNode,
}: {
  doc: Doc;
  selectedNodeId?: number | null;
  onSelectNode?: (id: number | null) => void;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${doc.width} ${doc.height}`}
      width={doc.width}
      height={doc.height}
      className="block"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelectNode?.(null);
      }}
    >
      <rect x={0} y={0} width={doc.width} height={doc.height} fill={doc.background} />
      {doc.nodes.map((node) =>
        node.enabled ? (
          <g
            key={node.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectNode?.(node.id);
            }}
            style={{
              cursor: onSelectNode ? "pointer" : undefined,
              outline:
                selectedNodeId === node.id ? "1px dashed rgba(255,255,255,0.4)" : undefined,
            }}
          >
            <NodeContent node={node} />
          </g>
        ) : null,
      )}
    </svg>
  );
}
