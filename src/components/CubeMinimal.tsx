import React, { useEffect, useRef, useState } from "react";

type Mode = "AUTO" | "DRAG";

export default function CubeMinimal() {
  // UI state (cursor etc.)
  const [mode, setMode] = useState<Mode>("AUTO");

  // Mode ref (avoid stale closure)
  const modeRef = useRef<Mode>("AUTO");
  const setModeBoth = (next: Mode) => {
    modeRef.current = next;
    setMode(next);
  };

  const cubeRef = useRef<HTMLDivElement | null>(null);

  // RAF + timing
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Rotation (high frequency)
  const rotXRef = useRef<number>(-30);
  const rotYRef = useRef<number>(0);

  // Drag tracking
  const pointerIdRef = useRef<number | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);
  const dragStartRotXRef = useRef<number>(0);
  const dragStartRotYRef = useRef<number>(0);

  // Constants
  const ATTRACT_X = -30;
  const AUTO_SPEED = 15; // deg/sec
  const DRAG_SPEED = 0.3; // deg/px
  const MAX_DT = 50; // ms

  // NEW: wait in released pose before returning X
  const WAIT_MS = 1000; // <- tweak this
  const RETURN_DURATION_MS = 600; // <- tweak this

  // Return-to-attract state
  const waitTimeoutRef = useRef<number | null>(null);
  const returnActiveRef = useRef<boolean>(false);
  const returnStartTimeRef = useRef<number>(0);
  const returnFromXRef = useRef<number>(ATTRACT_X);

  // NEW: whether AUTO spin (Y rotation) is currently allowed
  const spinEnabledRef = useRef<boolean>(true);

  const applyTransform = () => {
    const el = cubeRef.current;
    if (!el) return;
    el.style.transform = `rotateX(${rotXRef.current}deg) rotateY(${rotYRef.current}deg)`;
  };

  const stopRAF = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const startRAF = () => {
    stopRAF();
    lastTimeRef.current = 0; // init inside tick
    rafRef.current = requestAnimationFrame(tick);
  };

  const clearWait = () => {
    if (waitTimeoutRef.current !== null) {
      window.clearTimeout(waitTimeoutRef.current);
      waitTimeoutRef.current = null;
    }
  };

  const clearReturn = () => {
    clearWait();
    returnActiveRef.current = false;
    returnStartTimeRef.current = 0;
  };

  // NEW: wait, then start a smooth X return
  const scheduleWaitThenReturnX = () => {
    clearReturn();

    // Freeze in released pose during wait (no Y spin)
    spinEnabledRef.current = false;

    waitTimeoutRef.current = window.setTimeout(() => {
      // Start smooth X return
      returnFromXRef.current = rotXRef.current;
      returnStartTimeRef.current = 0;
      returnActiveRef.current = true;

      // After waiting, resume spin (while returning X)
      spinEnabledRef.current = true;
    }, WAIT_MS);
  };

  // Smoothstep easing
  const easeInOut = (t: number) => t * t * (3 - 2 * t);

  const tick = (t: number) => {
    if (modeRef.current !== "AUTO") return;

    // Init timestamp
    if (lastTimeRef.current === 0) lastTimeRef.current = t;

    let dt = t - lastTimeRef.current;
    lastTimeRef.current = t;
    dt = Math.min(dt, MAX_DT);

    // Only spin around Y when enabled
    if (spinEnabledRef.current) {
      rotYRef.current += AUTO_SPEED * (dt / 1000);
    }

    // If active, animate X back to attract
    if (returnActiveRef.current) {
      if (returnStartTimeRef.current === 0) {
        returnStartTimeRef.current = t;
      }
      const elapsed = t - returnStartTimeRef.current;
      const u = Math.min(1, elapsed / RETURN_DURATION_MS);
      const eased = easeInOut(u);

      rotXRef.current =
        returnFromXRef.current + (ATTRACT_X - returnFromXRef.current) * eased;

      if (u >= 1) {
        rotXRef.current = ATTRACT_X;
        returnActiveRef.current = false;
      }
    }

    applyTransform();
    rafRef.current = requestAnimationFrame(tick);
  };

  // -------- Robust drag end (global safety net) --------
  const cleanupGlobalDragListeners = () => {
    window.removeEventListener("pointerup", onWindowPointerUp, true);
    window.removeEventListener("pointercancel", onWindowPointerCancel, true);
    window.removeEventListener("blur", onWindowBlur, true);
  };

  const endDrag = (pointerId?: number) => {
    if (
      pointerId !== undefined &&
      pointerIdRef.current !== null &&
      pointerId !== pointerIdRef.current
    ) {
      return;
    }

    if (modeRef.current !== "DRAG") {
      cleanupGlobalDragListeners();
      pointerIdRef.current = null;
      return;
    }

    const el = cubeRef.current;
    if (el && pointerIdRef.current !== null) {
      try {
        el.releasePointerCapture(pointerIdRef.current);
      } catch { }
    }

    pointerIdRef.current = null;
    cleanupGlobalDragListeners();

    // Enter AUTO, but wait in place before returning X
    setModeBoth("AUTO");
    scheduleWaitThenReturnX();
    startRAF();
  };

  const onWindowPointerUp = (ev: PointerEvent) => endDrag(ev.pointerId);
  const onWindowPointerCancel = (ev: PointerEvent) => endDrag(ev.pointerId);
  const onWindowBlur = () => endDrag();

  // -------- Pointer handlers --------
  const onPointerDown = (e: React.PointerEvent) => {
    const el = cubeRef.current;
    if (!el) return;

    // Stop any pending wait/return while user controls it
    clearReturn();

    // While dragging, don’t auto-spin
    spinEnabledRef.current = false;

    setModeBoth("DRAG");
    stopRAF();

    pointerIdRef.current = e.pointerId;
    try {
      el.setPointerCapture(e.pointerId);
    } catch { }

    window.addEventListener("pointerup", onWindowPointerUp, true);
    window.addEventListener("pointercancel", onWindowPointerCancel, true);
    window.addEventListener("blur", onWindowBlur, true);

    dragStartXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    dragStartRotXRef.current = rotXRef.current;
    dragStartRotYRef.current = rotYRef.current;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (modeRef.current !== "DRAG") return;
    if (pointerIdRef.current !== e.pointerId) return;

    const dx = e.clientX - dragStartXRef.current;
    const dy = e.clientY - dragStartYRef.current;

    rotYRef.current = dragStartRotYRef.current + dx * DRAG_SPEED;
    rotXRef.current = dragStartRotXRef.current - dy * DRAG_SPEED;

    applyTransform();
  };

  const onPointerUp = (e: React.PointerEvent) => endDrag(e.pointerId);

  const onLostPointerCapture = () => endDrag();

  // Pause/resume on tab visibility
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        stopRAF();
      } else if (modeRef.current === "AUTO") {
        startRAF();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // Initial mount + cleanup
  useEffect(() => {
    rotXRef.current = ATTRACT_X;
    rotYRef.current = 0;
    applyTransform();

    setModeBoth("AUTO");

    // Start in attract mode spinning
    clearReturn();
    spinEnabledRef.current = true;
    startRAF();

    return () => {
      stopRAF();
      cleanupGlobalDragListeners();
      clearReturn();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center justify-center py-24">
      <style>{`
        .scene { perspective: 900px; }
        .cube {
          position: relative;
          width: 260px;
          height: 260px;
          transform-style: preserve-3d;
          user-select: none;
          touch-action: none;
          will-change: transform;
        }
        .face {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
          font-weight: 700;
          color: white;
          backface-visibility: hidden;
        }
        .front  { transform: rotateY(  0deg) translateZ(130px); background: #ff6f61; }
        .back   { transform: rotateY(180deg) translateZ(130px); background: #ffd700; }
        .right  { transform: rotateY( 90deg) translateZ(130px); background: #32cd32; }
        .left   { transform: rotateY(-90deg) translateZ(130px); background: #ff0000; }
        .top    { transform: rotateX( 90deg) translateZ(130px); background: #8a2be2; }
        .bottom { transform: rotateX(-90deg) translateZ(130px); background: #444; }
      `}</style>

      <div className="scene">
        <div
          ref={cubeRef}
          className={`cube ${mode === "DRAG" ? "cursor-grabbing" : "cursor-grab"}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={onLostPointerCapture}
        >
          <div className="face front">1</div>
          <div className="face back">2</div>
          <div className="face right">3</div>
          <div className="face left">4</div>
          <div className="face top">5</div>
          <div className="face bottom">6</div>
        </div>
      </div>
    </div>
  );
}
