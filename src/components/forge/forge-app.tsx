import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconArrowDownToLine,
  IconArrowRotateAnticlockwise,
  IconArrowRotateClockwise,
  IconChevronRight,
  IconCopy,
  IconCrosshairs2,
  IconDice5,
  IconEye,
  IconEyeSlash,
  IconGripDotsVertical,
  IconPlus,
  IconXmark,
} from "nucleo-pixel";
import { Link } from "@tanstack/react-router";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ColorControl, SliderControl, ToggleControl } from "@/components/dither/controls";
import { cn } from "@/lib/utils";
import { DocSvg } from "@/lib/forge/render";
import { getPrimitiveCenter } from "@/lib/forge/engine";
import { downloadPng, downloadSvg } from "@/lib/forge/export";
import { useUndoableDoc } from "@/lib/forge/use-undoable-doc";
import {
  makeDefaultDoc,
  makeGroup,
  makeModifier,
  makeNode,
  MODIFIER_KINDS,
  MODIFIER_LABELS,
  nextModId,
  nextNodeId,
  PRIMITIVE_KINDS,
  PRIMITIVE_LABELS,
  randomizeNode,
} from "@/lib/forge/defaults";
import { PREFABS, type Prefab } from "@/lib/forge/prefabs";
import {
  deepCloneWithFreshIds,
  findNode,
  insertIntoGroup,
  insertSiblingAfter,
  insertSiblingBefore,
  isDescendantOrSelf,
  mapNode,
  removeNodeById,
} from "@/lib/forge/tree";
import type {
  Doc,
  Modifier,
  ModifierKind,
  Node,
  PrimitiveKind,
  PrimitiveNode,
} from "@/lib/forge/types";
import {
  FontsSection,
  GrainControls,
  LinkedSliders,
  ModifierControls,
  NodeStyleControls,
  PaletteEditor,
  PrimitiveControls,
} from "./controls";
import { initBuiltInFonts } from "@/lib/forge/font-registry";
import { subscribePixelate } from "@/lib/forge/modifiers/pixelate/runtime";

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 8;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export default function ForgeApp() {
  const initialDocRef = useRef<Doc | null>(null);
  if (initialDocRef.current === null) initialDocRef.current = makeDefaultDoc();
  const { doc, setDoc, undo, redo, replace: replaceDoc, canUndo, canRedo } =
    useUndoableDoc<Doc>(initialDocRef.current);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(
    () => doc.nodes[0]?.id ?? null,
  );

  const selectedNode = useMemo(
    () => (selectedNodeId == null ? null : findNode(doc.nodes, selectedNodeId) ?? null),
    [doc.nodes, selectedNodeId],
  );

  // ---------- doc + node mutations ----------
  const patchDoc = useCallback((patch: Partial<Doc>) => {
    setDoc((d) => ({ ...d, ...patch }));
  }, []);

  const addNode = useCallback(
    (kind: PrimitiveKind) => {
      setDoc((d) => {
        const node = makeNode(kind, nextNodeId());
        setSelectedNodeId(node.id);
        // Prepend so new nodes appear at the top of the sidebar = visually in front.
        return { ...d, nodes: [node, ...d.nodes] };
      });
    },
    [setDoc],
  );

  const addPrefab = useCallback(
    (prefab: Prefab) => {
      setDoc((d) => {
        const node = prefab.build({
          docCenter: { x: d.width / 2, y: d.height / 2 },
          palette: d.palette,
        });
        setSelectedNodeId(node.id);
        return { ...d, nodes: [node, ...d.nodes] };
      });
    },
    [setDoc],
  );

  const removeNode = useCallback(
    (id: number) => {
      setDoc((d) => ({ ...d, nodes: removeNodeById(d.nodes, id) }));
      setSelectedNodeId((curr) => (curr === id ? null : curr));
    },
    [setDoc],
  );

  const duplicateNode = useCallback(
    (id: number) => {
      setDoc((d) => {
        const src = findNode(d.nodes, id);
        if (!src) return d;
        const copy = deepCloneWithFreshIds(src, nextNodeId, nextModId);
        copy.name = `${src.name} copy`;
        // Insert ABOVE the source so the copy ends up visually in front
        // (works at the top level or inside a group).
        const inserted = insertSiblingBefore(d.nodes, id, copy);
        setSelectedNodeId(copy.id);
        return { ...d, nodes: inserted };
      });
    },
    [setDoc],
  );

  const toggleNode = useCallback(
    (id: number) => {
      setDoc((d) => ({
        ...d,
        nodes: mapNode(d.nodes, id, (n) => ({ ...n, enabled: !n.enabled })),
      }));
    },
    [setDoc],
  );

  const reorderNode = useCallback(
    (fromId: number, toId: number, edge: Edge) => {
      if (fromId === toId) return;
      setDoc((d) => {
        // Block dropping a group into one of its own descendants. The other
        // direction (descendant -> ancestor sibling) is fine because the
        // moved node is removed first, breaking the cycle naturally.
        if (isDescendantOrSelf(d.nodes, fromId, toId)) return d;
        const moved = findNode(d.nodes, fromId);
        if (!moved) return d;
        const without = removeNodeById(d.nodes, fromId);
        const placed =
          edge === "top"
            ? insertSiblingBefore(without, toId, moved)
            : insertSiblingAfter(without, toId, moved);
        if (placed === without) return d;
        return { ...d, nodes: placed };
      });
    },
    [setDoc],
  );

  // Move a node into a group as its first child. Used by the group drop
  // zones in the sidebar so users can target empty groups (where there's
  // no sibling row to drop above/below).
  const moveIntoGroup = useCallback(
    (sourceId: number, groupId: number) => {
      if (sourceId === groupId) return;
      setDoc((d) => {
        if (isDescendantOrSelf(d.nodes, sourceId, groupId)) return d;
        const moved = findNode(d.nodes, sourceId);
        if (!moved) return d;
        const target = findNode(d.nodes, groupId);
        if (!target || target.kind !== "group") return d;
        const without = removeNodeById(d.nodes, sourceId);
        return { ...d, nodes: insertIntoGroup(without, groupId, moved) };
      });
    },
    [setDoc],
  );

  const reorderModifier = useCallback(
    (nodeId: number, fromId: number, toId: number, edge: Edge) => {
      if (fromId === toId) return;
      setDoc((d) => ({
        ...d,
        nodes: mapNode(d.nodes, nodeId, (n) => {
          const fromIdx = n.modifiers.findIndex((m) => m.id === fromId);
          if (fromIdx < 0) return n;
          const mods = [...n.modifiers];
          const [moved] = mods.splice(fromIdx, 1);
          const toIdx = mods.findIndex((m) => m.id === toId);
          if (toIdx < 0) {
            mods.push(moved);
          } else {
            mods.splice(edge === "top" ? toIdx : toIdx + 1, 0, moved);
          }
          return { ...n, modifiers: mods } as Node;
        }),
      }));
    },
    [setDoc],
  );

  const patchModifierParams = useCallback(
    (nodeId: number, modId: number, paramsPatch: Record<string, unknown>) => {
      setDoc((d) => ({
        ...d,
        nodes: mapNode(d.nodes, nodeId, (n) => ({
          ...n,
          modifiers: n.modifiers.map((m) =>
            m.id === modId
              ? ({ ...m, params: { ...m.params, ...paramsPatch } } as Modifier)
              : m,
          ),
        } as Node)),
      }));
    },
    [setDoc],
  );

  // Wrap selected node in a new group. With multi-select we'd take many;
  // for v1 it's the single selected node so the user can drop more into
  // the new group via drag-and-drop afterwards.
  const groupSelected = useCallback(() => {
    if (selectedNodeId == null) return;
    setDoc((d) => {
      const target = findNode(d.nodes, selectedNodeId);
      if (!target) return d;
      const group = makeGroup(nextNodeId(), [target]);
      const without = removeNodeById(d.nodes, selectedNodeId);
      const placed = insertSiblingBefore(without, selectedNodeId, group);
      // If the target was nested somewhere and removing then inserting
      // didn't land (sibling already gone), prepend at top level.
      const nodes = placed === without ? [group, ...without] : placed;
      setSelectedNodeId(group.id);
      return { ...d, nodes };
    });
  }, [selectedNodeId, setDoc]);

  // Replace a group with its children (in place). Children retain their
  // own modifiers; the group's modifiers are discarded.
  const ungroupSelected = useCallback(() => {
    if (selectedNodeId == null) return;
    setDoc((d) => {
      const target = findNode(d.nodes, selectedNodeId);
      if (!target || target.kind !== "group") return d;
      const without = removeNodeById(d.nodes, selectedNodeId);
      // Splice children in where the group used to live.
      let nodes: Node[] = without;
      let anchor: number | null = null;
      for (const c of target.children) {
        if (anchor === null) {
          nodes = [c, ...nodes];
          anchor = c.id;
        } else {
          nodes = insertSiblingAfter(nodes, anchor, c);
          anchor = c.id;
        }
      }
      setSelectedNodeId(target.children[0]?.id ?? null);
      return { ...d, nodes };
    });
  }, [selectedNodeId, setDoc]);

  const patchNode = useCallback(
    (id: number, patch: Partial<Node>) => {
      setDoc((d) => ({
        ...d,
        nodes: mapNode(d.nodes, id, (n) => ({ ...n, ...patch } as Node)),
      }));
    },
    [setDoc],
  );

  // Only valid on primitive nodes — groups don't have a primitive.
  const patchPrimitiveParams = useCallback(
    (id: number, paramsPatch: Record<string, unknown>) => {
      setDoc((d) => ({
        ...d,
        nodes: mapNode(d.nodes, id, (n) => {
          if (n.kind !== "primitive") return n;
          return {
            ...n,
            primitive: {
              ...n.primitive,
              params: { ...n.primitive.params, ...paramsPatch },
            },
          } as Node;
        }),
      }));
    },
    [setDoc],
  );

  // ---------- modifiers ----------
  const addModifier = useCallback(
    (nodeId: number, kind: ModifierKind) => {
      setDoc((d) => ({
        ...d,
        nodes: mapNode(d.nodes, nodeId, (n) => {
          const center =
            n.kind === "primitive"
              ? getPrimitiveCenter(n.primitive)
              : { x: d.width / 2, y: d.height / 2 };
          return {
            ...n,
            modifiers: [...n.modifiers, makeModifier(kind, nextModId(), center)],
          } as Node;
        }),
      }));
    },
    [setDoc],
  );

  const removeModifier = useCallback(
    (nodeId: number, modId: number) => {
      setDoc((d) => ({
        ...d,
        nodes: mapNode(
          d.nodes,
          nodeId,
          (n) =>
            ({ ...n, modifiers: n.modifiers.filter((m) => m.id !== modId) } as Node),
        ),
      }));
    },
    [setDoc],
  );

  const duplicateModifier = useCallback(
    (nodeId: number, modId: number) => {
      setDoc((d) => ({
        ...d,
        nodes: mapNode(d.nodes, nodeId, (n) => {
          const idx = n.modifiers.findIndex((m) => m.id === modId);
          if (idx < 0) return n;
          const copy: Modifier = {
            ...structuredClone(n.modifiers[idx]),
            id: nextModId(),
          };
          const modifiers = [...n.modifiers];
          modifiers.splice(idx + 1, 0, copy);
          return { ...n, modifiers } as Node;
        }),
      }));
    },
    [setDoc],
  );

  const toggleModifier = useCallback(
    (nodeId: number, modId: number) => {
      setDoc((d) => ({
        ...d,
        nodes: mapNode(d.nodes, nodeId, (n) => ({
          ...n,
          modifiers: n.modifiers.map((m) =>
            m.id === modId ? { ...m, enabled: !m.enabled } : m,
          ),
        } as Node)),
      }));
    },
    [setDoc],
  );


  const resetDoc = useCallback(() => {
    if (!confirm("Reset to default document?")) return;
    const fresh = makeDefaultDoc();
    replaceDoc(fresh);
    setSelectedNodeId(fresh.nodes[0]?.id ?? null);
  }, [replaceDoc]);

  const randomizeSelectedNode = useCallback(() => {
    if (selectedNodeId == null) return;
    setDoc((d) => ({
      ...d,
      nodes: mapNode(d.nodes, selectedNodeId, (n) => randomizeNode(n, d.palette)),
    }));
  }, [selectedNodeId, setDoc]);

  // Snap a node's center to doc center. For primitive nodes that means the
  // primitive's (cx, cy); for groups we re-center the modifier params
  // (radialRepeat / clip / mirror) but leave children alone — children
  // have their own positions.
  const centerSelectedNode = useCallback(() => {
    if (selectedNodeId == null) return;
    setDoc((d) => {
      const docCx = d.width / 2;
      const docCy = d.height / 2;
      return {
        ...d,
        nodes: mapNode(d.nodes, selectedNodeId, (n) => {
          // Re-anchor centerable modifier params for both kinds.
          const newMods = n.modifiers.map((m) => {
            if (m.kind === "radialRepeat" || m.kind === "clip") {
              return { ...m, params: { ...m.params, cx: docCx, cy: docCy } } as Modifier;
            }
            if (m.kind === "mirror") {
              return {
                ...m,
                params: { ...m.params, center: m.params.axis === "x" ? docCy : docCx },
              } as Modifier;
            }
            return m;
          });
          if (n.kind === "group") return { ...n, modifiers: newMods };
          // Primitive: also move the primitive itself.
          const baseParams = { ...n.primitive.params, cx: docCx, cy: docCy };
          const newPrim = (
            n.primitive.kind === "text"
              ? {
                  ...n.primitive,
                  params: { ...baseParams, anchor: "middle", baseline: "middle" },
                }
              : { ...n.primitive, params: baseParams }
          ) as PrimitiveNode["primitive"];
          return { ...n, primitive: newPrim, modifiers: newMods };
        }),
      };
    });
  }, [selectedNodeId, setDoc]);

  // Kick off built-in font parsing so booleans on text work without
  // ceremony. Subsequent local-fonts loads happen on user action.
  useEffect(() => {
    void initBuiltInFonts();
  }, []);

  // The pixelate modifier is sync-on-the-outside, async-on-the-inside:
  // it rasterizes the node's SVG fragment to a canvas and reads pixel
  // colors, then caches the resulting cell grid. The first frame after
  // a relevant change (cellSize, doc geometry) returns the un-pixelated
  // geometry as a placeholder while the raster fires off; when the
  // cache fills it notifies here so we re-render and the next expand()
  // hits the cache. Bump a counter to force a render — the value is
  // unused, just the state change triggers React.
  const [, forceRender] = useState(0);
  useEffect(() => {
    return subscribePixelate(() => forceRender((n) => n + 1));
  }, []);

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const k = e.key.toLowerCase();
      // Don't intercept while typing in inputs/textarea
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))
        return;
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // ---------- canvas zoom + pan ----------
  const stageRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cz = zoomRef.current;
      const cp = panRef.current;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const nz = clamp(cz * factor, ZOOM_MIN, ZOOM_MAX);
      if (nz === cz) return;
      const wx = (mx - cp.x) / cz;
      const wy = (my - cp.y) / cz;
      setZoom(nz);
      setPan({ x: mx - wx * nz, y: my - wy * nz });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    setPanning(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startPan = { ...panRef.current };
    const onMove = (ev: PointerEvent) => {
      setPan({ x: startPan.x + (ev.clientX - startX), y: startPan.y + (ev.clientY - startY) });
    };
    const onUp = () => {
      setPanning(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // ---------- exports ----------
  const onExportSvg = useCallback(() => {
    downloadSvg(doc, `forge-${Date.now()}.svg`);
  }, [doc]);
  const onExportPng = useCallback(() => {
    void downloadPng(doc, `forge-${Date.now()}.png`, 2);
  }, [doc]);

  return (
    <div className="relative grid h-full grid-cols-[340px_1fr] font-sans text-sm">
      {/* ===== SIDEBAR ===== */}
      <aside className="flex min-h-0 flex-col border-r border-border bg-background overflow-hidden">
        <div className="flex shrink-0 items-baseline justify-between border-b border-border px-5 py-4">
          <h1 className="font-mondwest text-3xl leading-none tracking-tight">forge.</h1>
          <Link
            to="/"
            className="text-xs tracking-widest text-muted-foreground uppercase hover:text-foreground transition-colors"
          >
            ← pressroom
          </Link>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <DocSection
            doc={doc}
            onPatch={patchDoc}
            onPatchGrain={(p) => patchDoc({ grain: { ...doc.grain, ...p } })}
          />

          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">
              Nodes
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {doc.nodes.length.toString().padStart(2, "0")}
            </span>
          </div>
          <div className="flex flex-col gap-1 px-3.5 pb-2">
            {doc.nodes.length === 0 ? (
              <div className="px-3 py-3.5 text-center text-xs text-muted-foreground italic">
                no nodes — add one below
              </div>
            ) : (
              <NodeTree
                nodes={doc.nodes}
                selectedNodeId={selectedNodeId}
                onSelect={setSelectedNodeId}
                onToggle={toggleNode}
                onDuplicate={duplicateNode}
                onRemove={removeNode}
                onReorder={reorderNode}
                onMoveIntoGroup={moveIntoGroup}
              />
            )}
          </div>
          <div className="grid grid-cols-3 gap-1 px-3.5 pb-3">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="border border-dashed border-border bg-transparent px-2 py-2.5 text-xs tracking-widest uppercase transition-colors hover:bg-foreground hover:text-background hover:border-solid"
                  >
                    + primitive
                  </button>
                }
              />
              <DropdownMenuContent align="start" side="top" className="w-[260px]">
                {PRIMITIVE_KINDS.map((kind) => (
                  <DropdownMenuItem
                    key={kind}
                    onClick={() => addNode(kind)}
                    className="lowercase"
                  >
                    {PRIMITIVE_LABELS[kind]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="border border-dashed border-border bg-transparent px-2 py-2.5 text-xs tracking-widest uppercase transition-colors hover:bg-foreground hover:text-background hover:border-solid"
                  >
                    + prefab
                  </button>
                }
              />
              <DropdownMenuContent align="start" side="top" className="w-[280px]">
                {PREFABS.map((prefab) => (
                  <DropdownMenuItem
                    key={prefab.id}
                    onClick={() => addPrefab(prefab)}
                    className="flex flex-col items-start gap-0 py-1.5"
                  >
                    <span className="lowercase">{prefab.name}</span>
                    <span className="font-mondwest text-sm text-muted-foreground leading-tight">
                      {prefab.description}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => {
                if (selectedNodeId != null) {
                  // Wrap the selected node in a new group.
                  groupSelected();
                } else {
                  // Nothing selected: create an empty group at the top.
                  setDoc((d) => {
                    const g = makeGroup(nextNodeId());
                    setSelectedNodeId(g.id);
                    return { ...d, nodes: [g, ...d.nodes] };
                  });
                }
              }}
              className="border border-dashed border-border bg-transparent px-2 py-2.5 text-xs tracking-widest uppercase transition-colors hover:bg-foreground hover:text-background hover:border-solid"
              title={
                selectedNodeId != null
                  ? "wrap selection in a group"
                  : "add empty group"
              }
            >
              + group
            </button>
          </div>

          {selectedNode && (
            <PropertiesPanel
              node={selectedNode}
              palette={doc.palette}
              nodes={doc.nodes}
              onRandomize={randomizeSelectedNode}
              onCenter={centerSelectedNode}
              onUngroup={ungroupSelected}
              onPatchNode={(patch) => patchNode(selectedNode.id, patch)}
              onPatchPrimitive={(patch) => patchPrimitiveParams(selectedNode.id, patch)}
              onAddModifier={(k) => addModifier(selectedNode.id, k)}
              onRemoveModifier={(mid) => removeModifier(selectedNode.id, mid)}
              onToggleModifier={(mid) => toggleModifier(selectedNode.id, mid)}
              onDuplicateModifier={(mid) => duplicateModifier(selectedNode.id, mid)}
              onReorderModifier={(fromId, toId, edge) =>
                reorderModifier(selectedNode.id, fromId, toId, edge)
              }
              onPatchModifierParams={(mid, patch) =>
                patchModifierParams(selectedNode.id, mid, patch)
              }
            />
          )}
        </ScrollArea>

        <div className="flex shrink-0 flex-col gap-1.5 border-t border-border px-5 py-3.5 bg-background">
          <Button
            variant="outline"
            size="default"
            className="justify-between text-xs tracking-widest uppercase"
            onClick={onExportSvg}
          >
            <span>Export SVG</span>
            <IconArrowDownToLine className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="default"
            className="justify-between text-xs tracking-widest uppercase"
            onClick={onExportPng}
          >
            <span>Export PNG</span>
            <IconArrowDownToLine className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="default"
            className="justify-between text-xs tracking-widest uppercase"
            onClick={resetDoc}
          >
            <span>Reset</span>
            <IconArrowRotateAnticlockwise className="size-3.5" />
          </Button>
        </div>
      </aside>

      {/* ===== STAGE ===== */}
      <main
        className="relative flex flex-col overflow-hidden"
        style={{
          background:
            "repeating-linear-gradient(0deg,transparent,transparent 19px,oklch(0.145 0 0 / 0.04) 19px,oklch(0.145 0 0 / 0.04) 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,oklch(0.145 0 0 / 0.04) 19px,oklch(0.145 0 0 / 0.04) 20px),var(--background)",
        }}
      >
        <div className="flex h-12 shrink-0 items-center gap-6 border-b border-border bg-background px-5">
          <span className="text-xs tracking-widest text-muted-foreground uppercase">
            workspace <span className="font-medium text-foreground">/ forge</span>
          </span>
          <div className="flex-1" />
          <span className="font-mondwest text-base">
            {doc.width} × {doc.height} · {doc.nodes.length} nodes · {Math.round(zoom * 100)}%
          </span>
        </div>

        <div
          ref={stageRef}
          className="relative flex flex-1 items-center justify-center overflow-hidden p-10"
          onPointerDown={(e) => {
            // Pan only when clicking the empty background (not the SVG itself).
            if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === "DIV") {
              startPan(e);
            }
          }}
          onDoubleClick={resetView}
        >
          <div
            className={cn(
              "absolute will-change-transform",
              panning ? "cursor-grabbing" : "cursor-grab",
            )}
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
            }}
          >
            <div
              className="will-change-transform"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "0 0",
                boxShadow: "0 30px 60px -20px rgba(0,0,0,0.25), 0 0 0 1px var(--foreground)",
              }}
            >
              <DocSvg
                doc={doc}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
              />
            </div>
          </div>
        </div>

        <div className="flex h-8 shrink-0 items-center gap-5 border-t border-border bg-background px-5 text-xs tracking-widest text-muted-foreground uppercase">
          <span className="text-foreground">● ready</span>
          <span className="opacity-40">/</span>
          <span>
            selected:{" "}
            <span className="text-foreground">
              {selectedNode ? selectedNode.name : "—"}
            </span>
          </span>
          <span className="opacity-40">/</span>
          <span>
            {selectedNode
              ? `${selectedNode.modifiers.length} modifier${selectedNode.modifiers.length === 1 ? "" : "s"}`
              : "—"}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="flex items-center gap-1 text-foreground hover:opacity-60 disabled:opacity-30"
            title="undo (⌘Z)"
          >
            <IconArrowRotateAnticlockwise className="size-3" /> undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="flex items-center gap-1 text-foreground hover:opacity-60 disabled:opacity-30"
            title="redo (⌘⇧Z)"
          >
            redo <IconArrowRotateClockwise className="size-3" />
          </button>
          <span className="opacity-40">/</span>
          <button
            type="button"
            onClick={resetView}
            className="text-foreground hover:opacity-60"
            title="reset view"
          >
            reset view
          </button>
        </div>
      </main>
    </div>
  );
}

// ---------- subviews ----------

function DocSection({
  doc,
  onPatch,
  onPatchGrain,
}: {
  doc: Doc;
  onPatch: (p: Partial<Doc>) => void;
  onPatchGrain: (p: Partial<Doc["grain"]>) => void;
}) {
  return (
    <div className="border-b border-border bg-muted/20 px-3.5 py-3">
      <div className="mb-2 text-xs tracking-widest text-muted-foreground uppercase">
        Document
      </div>
      <LinkedSliders
        aName="width"
        bName="height"
        aValue={doc.width}
        bValue={doc.height}
        min={100}
        max={4000}
        unit="px"
        defaultLinked
        onChange={(width, height) => onPatch({ width, height })}
      />
      <ToggleControl
        name="background"
        value={doc.backgroundEnabled}
        onChange={(v) => onPatch({ backgroundEnabled: v })}
      />
      {doc.backgroundEnabled && (
        <ColorControl
          name="bg color"
          value={doc.background}
          onChange={(v) => onPatch({ background: v })}
        />
      )}
      <PaletteEditor palette={doc.palette} onChange={(p) => onPatch({ palette: p })} />
      <details className="mt-2 [&_summary]:cursor-pointer">
        <summary className="text-xs tracking-wider text-muted-foreground uppercase mb-1">
          fonts
        </summary>
        <FontsSection />
      </details>
      <details className="mt-2 [&_summary]:cursor-pointer">
        <summary className="text-xs tracking-wider text-muted-foreground uppercase mb-1">
          grain {doc.grain.enabled ? "· on" : "· off"}
        </summary>
        <GrainControls grain={doc.grain} onPatch={onPatchGrain} />
      </details>
    </div>
  );
}

const NODE_DRAG_TYPE = "forge-node";
const MODIFIER_DRAG_TYPE = "forge-modifier";

function NodeRow({
  node,
  index,
  selected,
  onSelect,
  onToggle,
  onDuplicate,
  onRemove,
  onReorder,
}: {
  node: Node;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onReorder: (fromId: number, toId: number, edge: Edge) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLSpanElement>(null);
  const [dragging, setDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  useEffect(() => {
    const el = rowRef.current;
    const grip = gripRef.current;
    if (!el || !grip) return;
    return combine(
      draggable({
        element: el,
        dragHandle: grip,
        getInitialData: () => ({ type: NODE_DRAG_TYPE, id: node.id }),
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) =>
          source.data.type === NODE_DRAG_TYPE && source.data.id !== node.id,
        getData: ({ input, element }) =>
          attachClosestEdge(
            { type: NODE_DRAG_TYPE, id: node.id },
            { input, element, allowedEdges: ["top", "bottom"] },
          ),
        getIsSticky: () => true,
        onDrag: ({ self, source }) => {
          if (source.data.id === node.id) {
            setClosestEdge(null);
            return;
          }
          setClosestEdge(extractClosestEdge(self.data));
        },
        onDragLeave: () => setClosestEdge(null),
        onDrop: ({ self, source }) => {
          setClosestEdge(null);
          const edge = extractClosestEdge(self.data);
          if (!edge) return;
          const fromId = source.data.id;
          if (typeof fromId === "number" && fromId !== node.id) {
            onReorder(fromId, node.id, edge);
          }
        },
      }),
    );
  }, [node.id, onReorder]);

  return (
    <div
      ref={rowRef}
      className={cn(
        "relative flex cursor-pointer items-center gap-2 border bg-background px-2 py-2 transition-colors",
        selected ? "border-foreground" : "border-border hover:border-foreground/40",
        !node.enabled && "opacity-50",
        dragging && "opacity-40",
      )}
      onClick={(e) => {
        if (
          (e.target as HTMLElement).closest("[data-node-action]") ||
          (e.target as HTMLElement).closest("[data-node-grip]")
        )
          return;
        onSelect();
      }}
    >
      {closestEdge === "top" && <DropIndicator position="top" />}
      {closestEdge === "bottom" && <DropIndicator position="bottom" />}
      <span
        ref={gripRef}
        data-node-grip
        className="text-muted-foreground flex shrink-0 cursor-grab opacity-40 hover:opacity-100 active:cursor-grabbing"
        title="drag to reorder"
      >
        <IconGripDotsVertical className="size-3.5" />
      </span>
      <span className="w-5 shrink-0 text-sm text-muted-foreground tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-xs tracking-widest text-muted-foreground uppercase">
          {node.kind === "group"
            ? `group · ${node.children.length}`
            : PRIMITIVE_LABELS[node.primitive.kind]}
        </span>
        <span className="block truncate text-sm">{node.name}</span>
      </span>
      <button
        type="button"
        data-node-action
        onClick={onToggle}
        title="toggle visibility"
        className={cn(
          "flex size-6 shrink-0 items-center justify-center border border-border transition-colors",
          node.enabled ? "bg-foreground text-background" : "bg-transparent hover:bg-muted",
        )}
      >
        {node.enabled ? <IconEye className="size-3" /> : <IconEyeSlash className="size-3" />}
      </button>
      <button
        type="button"
        data-node-action
        onClick={onDuplicate}
        title="duplicate"
        className="flex size-6 shrink-0 items-center justify-center border border-border hover:border-foreground/60 hover:bg-muted"
      >
        <IconCopy className="size-3" />
      </button>
      <button
        type="button"
        data-node-action
        onClick={onRemove}
        title="remove"
        className="flex size-6 shrink-0 items-center justify-center border border-border hover:border-destructive hover:bg-destructive hover:text-background"
      >
        <IconXmark className="size-3" />
      </button>
    </div>
  );
}

// Recursive renderer for the sidebar: walks the node tree and indents
// children under groups. Each NodeRow is its own draggable / drop target
// (existing pragmatic-dnd plumbing handles top/bottom edge sibling
// reordering). Drop-INTO-group reordering uses the group row itself as
// a drop target that prepends the dragged item into the group's children.
function NodeTree({
  nodes,
  selectedNodeId,
  onSelect,
  onToggle,
  onDuplicate,
  onRemove,
  onReorder,
  onMoveIntoGroup,
  depth = 0,
}: {
  nodes: Node[];
  selectedNodeId: number | null;
  onSelect: (id: number) => void;
  onToggle: (id: number) => void;
  onDuplicate: (id: number) => void;
  onRemove: (id: number) => void;
  onReorder: (fromId: number, toId: number, edge: Edge) => void;
  onMoveIntoGroup: (sourceId: number, groupId: number) => void;
  depth?: number;
}) {
  return (
    <>
      {nodes.map((node, idx) => (
        <div key={node.id} style={{ paddingLeft: depth * 14 }}>
          <NodeRow
            node={node}
            index={idx}
            selected={selectedNodeId === node.id}
            onSelect={() => onSelect(node.id)}
            onToggle={() => onToggle(node.id)}
            onDuplicate={() => onDuplicate(node.id)}
            onRemove={() => onRemove(node.id)}
            onReorder={onReorder}
          />
          {node.kind === "group" && (
            <>
              {node.children.length > 0 && (
                <div className="mt-1 flex flex-col gap-1">
                  <NodeTree
                    nodes={node.children}
                    selectedNodeId={selectedNodeId}
                    onSelect={onSelect}
                    onToggle={onToggle}
                    onDuplicate={onDuplicate}
                    onRemove={onRemove}
                    onReorder={onReorder}
                    onMoveIntoGroup={onMoveIntoGroup}
                    depth={depth + 1}
                  />
                </div>
              )}
              {/* Drop zone for adding to this group. Idle = thin dashed line;
                  on hover during a valid drag = solid highlight. Critical for
                  empty groups (no child rows to drop above/below). */}
              <GroupDropZone
                groupId={node.id}
                depth={depth + 1}
                empty={node.children.length === 0}
                onDrop={(srcId) => onMoveIntoGroup(srcId, node.id)}
              />
            </>
          )}
        </div>
      ))}
    </>
  );
}

function GroupDropZone({
  groupId,
  depth,
  empty,
  onDrop,
}: {
  groupId: number;
  depth: number;
  empty: boolean;
  onDrop: (sourceId: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === NODE_DRAG_TYPE,
      getData: () => ({ type: NODE_DRAG_TYPE, groupId, intoGroup: true }),
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: ({ source }) => {
        setOver(false);
        const srcId = source.data.id;
        if (typeof srcId === "number") onDrop(srcId);
      },
    });
  }, [groupId, onDrop]);

  return (
    <div
      ref={ref}
      style={{ paddingLeft: depth * 14 }}
      className={cn(
        "my-1 flex h-5 items-center transition-colors",
        over ? "" : "opacity-60",
      )}
    >
      <div
        className={cn(
          "h-full flex-1 border border-dashed text-[10px] tracking-wider uppercase text-muted-foreground flex items-center justify-center transition-colors",
          over
            ? "border-destructive bg-destructive/10 text-foreground"
            : "border-border/60",
        )}
      >
        {over ? "drop into group" : empty ? "drop here to add" : "·"}
      </div>
    </div>
  );
}

function DropIndicator({ position }: { position: "top" | "bottom" }) {
  const style: CSSProperties = position === "top" ? { top: -1 } : { bottom: -1 };
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-destructive"
      style={style}
    />
  );
}

function PropertiesPanel({
  node,
  palette,
  nodes,
  onRandomize,
  onCenter,
  onUngroup,
  onPatchNode,
  onPatchPrimitive,
  onAddModifier,
  onRemoveModifier,
  onToggleModifier,
  onDuplicateModifier,
  onReorderModifier,
  onPatchModifierParams,
}: {
  node: Node;
  palette: string[];
  nodes: Node[];
  onRandomize: () => void;
  onCenter: () => void;
  onUngroup: () => void;
  onPatchNode: (patch: Partial<Node>) => void;
  onPatchPrimitive: (patch: Record<string, unknown>) => void;
  onAddModifier: (k: ModifierKind) => void;
  onRemoveModifier: (mid: number) => void;
  onToggleModifier: (mid: number) => void;
  onDuplicateModifier: (mid: number) => void;
  onReorderModifier: (fromId: number, toId: number, edge: Edge) => void;
  onPatchModifierParams: (mid: number, patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="border-t border-border bg-muted/10">
      <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-2">
        <span className="text-xs tracking-widest text-muted-foreground uppercase">
          {node.name}
        </span>
        <div className="flex items-center gap-1">
          {node.kind === "group" && (
            <button
              type="button"
              onClick={onUngroup}
              title="ungroup (children rejoin the parent list)"
              className="flex items-center gap-1 border border-border px-2 py-1 text-xs tracking-wider uppercase hover:bg-foreground hover:text-background"
            >
              ungroup
            </button>
          )}
          <button
            type="button"
            onClick={onCenter}
            title="center on doc"
            className="flex items-center gap-1 border border-border px-2 py-1 text-xs tracking-wider uppercase hover:bg-foreground hover:text-background"
          >
            <IconCrosshairs2 className="size-3" /> center
          </button>
          <button
            type="button"
            onClick={onRandomize}
            title="randomize this node"
            className="flex items-center gap-1 border border-border px-2 py-1 text-xs tracking-wider uppercase hover:bg-foreground hover:text-background"
          >
            <IconDice5 className="size-3" /> randomize
          </button>
        </div>
      </div>
      {node.kind === "primitive" && (
        <PanelSection title="Primitive" sub={PRIMITIVE_LABELS[node.primitive.kind]}>
          <PrimitiveControls primitive={node.primitive} onPatch={onPatchPrimitive} />
        </PanelSection>
      )}
      {node.kind === "group" && (
        <PanelSection title="Group" sub={`${node.children.length} children`}>
          <p className="text-[11px] italic text-muted-foreground">
            drag nodes into this group's row in the layer list to add them.
            its modifier stack applies to the combined geometry of all
            children.
          </p>
        </PanelSection>
      )}

      <PanelSection
        title="Modifiers"
        sub={`${node.modifiers.length.toString().padStart(2, "0")}`}
      >
        <div className="flex flex-col gap-1.5">
          {node.modifiers.length === 0 ? (
            <div className="px-1 py-2 text-xs italic text-muted-foreground">
              no modifiers
            </div>
          ) : (
            node.modifiers.map((mod) => (
              <ModifierBlock
                key={mod.id}
                mod={mod}
                palette={palette}
                nodes={nodes}
                currentNodeId={node.id}
                onRemove={() => onRemoveModifier(mod.id)}
                onToggle={() => onToggleModifier(mod.id)}
                onDuplicate={() => onDuplicateModifier(mod.id)}
                onPatch={(patch) => onPatchModifierParams(mod.id, patch)}
                onReorder={onReorderModifier}
              />
            ))
          )}
        </div>
        <div className="mt-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="w-full border border-dashed border-border bg-transparent px-3 py-2 text-xs tracking-widest uppercase transition-colors hover:bg-foreground hover:text-background hover:border-solid"
                >
                  <IconPlus className="mr-1 inline size-3" /> Add modifier
                </button>
              }
            />
            <DropdownMenuContent align="start" side="top" className="w-[220px]">
              {MODIFIER_KINDS.map((kind) => (
                <DropdownMenuItem
                  key={kind}
                  onClick={() => onAddModifier(kind)}
                  className="lowercase"
                >
                  {MODIFIER_LABELS[kind]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PanelSection>

      {node.kind === "primitive" ? (
        <PanelSection title="Style">
          <NodeStyleControls
            fill={node.fill}
            fillEnabled={node.fillEnabled}
            stroke={node.stroke}
            strokeEnabled={node.strokeEnabled}
            strokeWidth={node.strokeWidth}
            opacity={node.opacity}
            palette={palette}
            onPatch={onPatchNode}
          />
        </PanelSection>
      ) : (
        // Groups only expose opacity; children carry their own fill/stroke.
        <PanelSection title="Style">
          <GroupOpacityControl
            opacity={node.opacity}
            onChange={(v) => onPatchNode({ opacity: v })}
          />
        </PanelSection>
      )}
    </div>
  );
}

function GroupOpacityControl({
  opacity,
  onChange,
}: {
  opacity: number;
  onChange: (v: number) => void;
}) {
  // Inline so we don't need to grow controls.tsx for one slider.
  return (
    <SliderControl
      name="opacity"
      min={0}
      max={1}
      step={0.05}
      value={opacity}
      onChange={onChange}
    />
  );
}

function PanelSection({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-border/60 px-3.5 py-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mb-2 flex w-full items-center gap-1.5 text-xs tracking-widest text-muted-foreground uppercase"
      >
        <IconChevronRight
          className={cn("size-3 transition-transform", open && "rotate-90 text-foreground")}
        />
        <span>{title}</span>
        {sub && <span className="ml-auto font-mono text-foreground/80">{sub}</span>}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function ModifierBlock({
  mod,
  palette,
  nodes,
  currentNodeId,
  onRemove,
  onToggle,
  onDuplicate,
  onPatch,
  onReorder,
}: {
  mod: Modifier;
  palette: string[];
  nodes: Node[];
  currentNodeId: number;
  onRemove: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onReorder: (fromId: number, toId: number, edge: Edge) => void;
}) {
  const [open, setOpen] = useState(true);
  const blockRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLSpanElement>(null);
  const [dragging, setDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  useEffect(() => {
    const el = blockRef.current;
    const grip = gripRef.current;
    if (!el || !grip) return;
    return combine(
      draggable({
        element: el,
        dragHandle: grip,
        getInitialData: () => ({ type: MODIFIER_DRAG_TYPE, id: mod.id }),
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) =>
          source.data.type === MODIFIER_DRAG_TYPE && source.data.id !== mod.id,
        getData: ({ input, element }) =>
          attachClosestEdge(
            { type: MODIFIER_DRAG_TYPE, id: mod.id },
            { input, element, allowedEdges: ["top", "bottom"] },
          ),
        getIsSticky: () => true,
        onDrag: ({ self, source }) => {
          if (source.data.id === mod.id) {
            setClosestEdge(null);
            return;
          }
          setClosestEdge(extractClosestEdge(self.data));
        },
        onDragLeave: () => setClosestEdge(null),
        onDrop: ({ self, source }) => {
          setClosestEdge(null);
          const edge = extractClosestEdge(self.data);
          if (!edge) return;
          const fromId = source.data.id;
          if (typeof fromId === "number" && fromId !== mod.id) {
            onReorder(fromId, mod.id, edge);
          }
        },
      }),
    );
  }, [mod.id, onReorder]);

  return (
    <div
      ref={blockRef}
      className={cn(
        "relative border border-border bg-background transition-opacity",
        !mod.enabled && "[&_[data-mod-body]]:opacity-40",
        dragging && "opacity-40",
      )}
    >
      {closestEdge === "top" && <DropIndicator position="top" />}
      {closestEdge === "bottom" && <DropIndicator position="bottom" />}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <span
          ref={gripRef}
          className="text-muted-foreground flex shrink-0 cursor-grab opacity-40 hover:opacity-100 active:cursor-grabbing"
          title="drag to reorder"
        >
          <IconGripDotsVertical className="size-3" />
        </span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-xs tracking-wider uppercase"
        >
          <IconChevronRight
            className={cn(
              "size-3 transition-transform text-muted-foreground",
              open && "rotate-90 text-foreground",
            )}
          />
          <span>{MODIFIER_LABELS[mod.kind]}</span>
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onToggle}
          title="toggle"
          className={cn(
            "flex size-5 items-center justify-center border border-border",
            mod.enabled ? "bg-foreground text-background" : "bg-transparent hover:bg-muted",
          )}
        >
          {mod.enabled ? <IconEye className="size-2.5" /> : <IconEyeSlash className="size-2.5" />}
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          title="duplicate"
          className="flex size-5 items-center justify-center border border-border hover:border-foreground/60 hover:bg-muted"
        >
          <IconCopy className="size-2.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          title="remove"
          className="flex size-5 items-center justify-center border border-border hover:border-destructive hover:bg-destructive hover:text-background"
        >
          <IconXmark className="size-2.5" />
        </button>
      </div>
      {open && (
        <div data-mod-body className="border-t border-border/40 px-2.5 py-2">
          <ModifierControls
            modifier={mod}
            palette={palette}
            nodes={nodes}
            currentNodeId={currentNodeId}
            onPatch={onPatch}
          />
        </div>
      )}
    </div>
  );
}
