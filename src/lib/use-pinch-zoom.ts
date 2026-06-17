// Multi-pointer pinch-zoom + two-finger-pan for canvas viewports.
//
// Wires onto a target element via pointerdown/move/up. While exactly
// two non-mouse pointers are active, distance between them drives
// zoom and midpoint movement drives pan — both anchored at the
// initial pinch midpoint so the content under your fingers stays
// under your fingers. Third pointer (or a leaving touch) bails out
// of pinch mode so the user can chain gestures naturally.
//
// Mouse pointers are ignored entirely so the existing wheel/drag
// handlers in the host keep working.

import { useEffect, type RefObject } from "react";

type Vec = { x: number; y: number };

type Options = {
  /** Element to listen on. Pinch only fires when the gesture starts
   *  here, so a stage with a child canvas should pass the stage ref. */
  targetRef: RefObject<HTMLElement | null>;
  /** Live zoom value via ref so updates don't rebind listeners. */
  zoomRef: RefObject<number>;
  /** Live pan value via ref via the same shape. */
  panRef: RefObject<Vec>;
  /** Called with the new zoom. Host clamps + commits state. */
  onZoom: (next: number) => void;
  onPan: (next: Vec) => void;
  minZoom: number;
  maxZoom: number;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function usePinchZoom({
  targetRef,
  zoomRef,
  panRef,
  onZoom,
  onPan,
  minZoom,
  maxZoom,
}: Options) {
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const pointers = new Map<number, Vec>();
    type PinchStart = {
      distance: number;
      midpoint: Vec;
      zoom: number;
      pan: Vec;
    };
    let pinch: PinchStart | null = null;

    function rectPoint(e: PointerEvent): Vec {
      const rect = target!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function midpoint(a: Vec, b: Vec): Vec {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    function distance(a: Vec, b: Vec): number {
      return Math.hypot(b.x - a.x, b.y - a.y);
    }

    function startPinch() {
      const pts = Array.from(pointers.values());
      if (pts.length !== 2) {
        pinch = null;
        return;
      }
      pinch = {
        distance: distance(pts[0], pts[1]),
        midpoint: midpoint(pts[0], pts[1]),
        zoom: zoomRef.current,
        pan: { ...panRef.current },
      };
    }

    const handleDown = (e: PointerEvent) => {
      // Don't take over the mouse — the host's wheel + drag handlers
      // are already tuned for it.
      if (e.pointerType === "mouse") return;
      pointers.set(e.pointerId, rectPoint(e));
      if (pointers.size === 2) startPinch();
      // 3+ pointers: cancel pinch so it doesn't lurch when one finger
      // lifts back to 2.
      else if (pointers.size > 2) pinch = null;
    };

    const handleMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, rectPoint(e));
      if (!pinch || pointers.size !== 2) return;
      // preventDefault to suppress iOS Safari's two-finger page-zoom
      // gesture; without it the OS will fight us mid-pinch and the
      // motion stutters.
      e.preventDefault();
      const pts = Array.from(pointers.values());
      const newDistance = distance(pts[0], pts[1]);
      const newMid = midpoint(pts[0], pts[1]);
      const scale = newDistance / Math.max(1, pinch.distance);
      const nextZoom = clamp(pinch.zoom * scale, minZoom, maxZoom);
      // Anchor zoom at the original midpoint and apply the two-finger
      // pan delta so the world point originally under the centroid
      // tracks where the centroid moved to.
      const worldX = (pinch.midpoint.x - pinch.pan.x) / pinch.zoom;
      const worldY = (pinch.midpoint.y - pinch.pan.y) / pinch.zoom;
      onZoom(nextZoom);
      onPan({
        x: newMid.x - worldX * nextZoom,
        y: newMid.y - worldY * nextZoom,
      });
    };

    const handleUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      else if (pointers.size === 2) startPinch();
    };

    target.addEventListener("pointerdown", handleDown);
    // passive: false so preventDefault works on iOS.
    target.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      target.removeEventListener("pointerdown", handleDown);
      target.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [targetRef, zoomRef, panRef, onZoom, onPan, minZoom, maxZoom]);
}
