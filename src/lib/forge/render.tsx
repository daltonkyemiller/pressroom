import { Fragment } from "react";
import { expandNode, getBooleanHiddenIds, type ClipDef } from "./engine";
import { polygonPath } from "./primitives/polygon/runtime";
import { wedgePath } from "./primitives/wedge/runtime";
import { svgPlacementTransform } from "./primitives/svg/runtime";
import type { Doc, Node, Primitive } from "./types";

// Wrap family names in quotes (CSS-safe for families with spaces), with
// a generic-family fallback so unknown fonts still render something.
function cssFontFamily(family: string): string {
  return `"${family.replace(/"/g, '\\"')}", system-ui, sans-serif`;
}

function renderPrimitive(primitive: Primitive) {
  switch (primitive.kind) {
    case "rect": {
      const p = primitive.params;
      return (
        <rect
          x={p.cx - p.w / 2}
          y={p.cy - p.h / 2}
          width={p.w}
          height={p.h}
          rx={p.rx}
        />
      );
    }
    case "ellipse": {
      const p = primitive.params;
      return <ellipse cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} />;
    }
    case "barStack": {
      // Renders one base rect (width × height centered on cx, cy). Each bar
      // instance (created by barStackInstances in engine.ts) carries the
      // translate + non-uniform scale to position and size it, so this same
      // <rect> draws every bar in the stack via its instance transform.
      const p = primitive.params;
      return (
        <rect
          x={p.cx - p.width / 2}
          y={p.cy - p.height / 2}
          width={p.width}
          height={p.height}
        />
      );
    }
    case "wedge":
      return <path d={wedgePath(primitive.params)} />;
    case "polygon":
      return <path d={polygonPath(primitive.params)} />;
    case "svg": {
      const placed = svgPlacementTransform(primitive.params);
      if (!placed) return null;
      return (
        <g
          transform={placed.transform}
          dangerouslySetInnerHTML={{ __html: placed.body }}
        />
      );
    }
    case "text": {
      const p = primitive.params;
      return (
        <text
          x={p.cx}
          y={p.cy}
          fontFamily={cssFontFamily(p.font)}
          fontSize={p.size}
          textAnchor={p.anchor}
          dominantBaseline={p.baseline}
          letterSpacing={p.letterSpacing || undefined}
          transform={p.rotation ? `rotate(${p.rotation} ${p.cx} ${p.cy})` : undefined}
          style={{ userSelect: "none" }}
        >
          {p.content}
        </text>
      );
    }
  }
}

function ClipPathDef({ def }: { def: ClipDef }) {
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

function NodeContent({
  node,
  allNodes,
  docSize,
}: {
  node: Node;
  allNodes: Node[];
  docSize: { width: number; height: number };
}) {
  const { instances, clipDefs } = expandNode(node, allNodes, docSize);
  return (
    <Fragment>
      {clipDefs.length > 0 && (
        <defs>
          {clipDefs.map((d) => (
            <ClipPathDef key={d.id} def={d} />
          ))}
        </defs>
      )}
      <g>
        {instances.map((inst, i) => (
          <g
            key={i}
            transform={inst.transform || undefined}
            clipPath={inst.clipPathId ? `url(#${inst.clipPathId})` : undefined}
            fill={inst.fill}
            stroke={inst.stroke}
            strokeWidth={inst.strokeWidth || undefined}
            opacity={inst.opacity}
          >
            {inst.pathOverride ? (
              <path d={inst.pathOverride} />
            ) : (
              renderPrimitive(inst.primitive)
            )}
          </g>
        ))}
      </g>
    </Fragment>
  );
}

function GrainOverlay({ doc }: { doc: Doc }) {
  if (!doc.grain.enabled || doc.grain.amount <= 0) return null;
  const id = "forge-grain";
  return (
    <Fragment>
      <defs>
        <filter id={id} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={doc.grain.frequency}
            numOctaves={doc.grain.octaves}
            seed={doc.grain.seed}
            stitchTiles="stitch"
          />
          {doc.grain.monochrome && (
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1
                      0 0 0 0 1
                      0 0 0 0 1
                      0 0 0 0.5 0"
            />
          )}
          <feComponentTransfer>
            <feFuncA type="linear" slope={doc.grain.amount} intercept={0} />
          </feComponentTransfer>
        </filter>
      </defs>
      <rect
        x={0}
        y={0}
        width={doc.width}
        height={doc.height}
        filter={`url(#${id})`}
        style={{ mixBlendMode: "overlay" }}
      />
    </Fragment>
  );
}

const CHECKER_PATTERN_ID = "forge-doc-transparent-checker";

export function DocSvg({
  doc,
  selectedNodeId,
  onSelectNode,
}: {
  doc: Doc;
  selectedNodeId?: number | null;
  onSelectNode?: (id: number | null) => void;
}) {
  const hidden = getBooleanHiddenIds(doc.nodes);
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
      {/* Editor-only: a subtle checker pattern shows through when the doc
          background is disabled, so transparency is visible. The pattern is
          NEVER written to exports (see export.ts) — those produce a truly
          transparent PNG / blank-background SVG. */}
      {!doc.backgroundEnabled && (
        <defs>
          <pattern
            id={CHECKER_PATTERN_ID}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <rect width="20" height="20" fill="#2a2a2a" />
            <rect width="10" height="10" fill="#1f1f1f" />
            <rect x="10" y="10" width="10" height="10" fill="#1f1f1f" />
          </pattern>
        </defs>
      )}
      <rect
        x={0}
        y={0}
        width={doc.width}
        height={doc.height}
        fill={doc.backgroundEnabled ? doc.background : `url(#${CHECKER_PATTERN_ID})`}
      />
      {/* Reverse: nodes[0] is the top of the sidebar and should paint LAST so
          it appears in front, matching Figma/Photoshop layer conventions. */}
      {[...doc.nodes].reverse().map((node) =>
        node.enabled && !hidden.has(node.id) ? (
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
            <NodeContent
              node={node}
              allNodes={doc.nodes}
              docSize={{ width: doc.width, height: doc.height }}
            />
          </g>
        ) : null,
      )}
      <GrainOverlay doc={doc} />
    </svg>
  );
}
