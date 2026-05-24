import { useCallback, useEffect, useRef, useState } from "react";

// Undo/redo state container with a debounced "commit" — bursts of rapid
// changes (slider scrubs) collapse into a single history entry once the
// user pauses for `debounceMs`. Discrete actions also flow through the
// same debounce, so add-node + immediate Ctrl+Z still works because undo
// flushes any pending baseline first.

export function useUndoableDoc<T>(initial: T, debounceMs = 250) {
  const [present, setPresent] = useState<T>(initial);
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  const pendingBaselineRef = useRef<T | null>(null);
  const timerRef = useRef<number | null>(null);
  const presentRef = useRef(present);
  useEffect(() => {
    presentRef.current = present;
  }, [present]);

  const flushPending = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingBaselineRef.current !== null) {
      const baseline = pendingBaselineRef.current;
      pendingBaselineRef.current = null;
      if (baseline !== presentRef.current) {
        setPast((p) => [...p, baseline]);
        setFuture([]);
      }
    }
  }, []);

  const setDoc = useCallback(
    (next: T | ((prev: T) => T)) => {
      setPresent((p) => {
        const value =
          typeof next === "function" ? (next as (prev: T) => T)(p) : next;
        if (Object.is(value, p)) return p;
        if (pendingBaselineRef.current === null) {
          pendingBaselineRef.current = p;
        }
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          if (pendingBaselineRef.current !== null) {
            const baseline = pendingBaselineRef.current;
            pendingBaselineRef.current = null;
            setPast((past) => [...past, baseline]);
            setFuture([]);
          }
        }, debounceMs);
        return value;
      });
    },
    [debounceMs],
  );

  const undo = useCallback(() => {
    flushPending();
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [presentRef.current, ...f]);
      setPresent(prev);
      return p.slice(0, -1);
    });
  }, [flushPending]);

  const redo = useCallback(() => {
    flushPending();
    setFuture((f) => {
      if (f.length === 0) return f;
      const [next, ...rest] = f;
      setPast((p) => [...p, presentRef.current]);
      setPresent(next);
      return rest;
    });
  }, [flushPending]);

  // Force-replace (skips history). Used for hard resets.
  const replace = useCallback((value: T) => {
    flushPending();
    setPast((p) => [...p, presentRef.current]);
    setFuture([]);
    setPresent(value);
  }, [flushPending]);

  return {
    doc: present,
    setDoc,
    undo,
    redo,
    replace,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
