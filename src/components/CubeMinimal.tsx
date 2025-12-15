import { useEffect, useRef, useState } from "react";

type Mode = "AUTO" | "DRAG";

/**
 * A minimal, performant CSS cube with:
 * - slow automatic rotation
 * - pointer-based dragging
 * - no per-frame React re-renders
 */
export default function CubeMinimal() {
  // ----- UI / mode state (low frequency) -----
  const [mode, setMode] = useState<Mode>("AUTO");

  // ----- DOM reference -----
  const cubeRef = useRef<HTMLDivElement | null>(null);

  // ----- Animation refs (high frequency, no re-renders) -----
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const rotXRef = useRef<number>(-30);
  const rotYRef = useRef<number>(0);

  // ----- Drag refs -----
  const pointerIdRef = useRef<number | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);
  const dragStartRotXRef = useRef<number>(0);
  const dragStartRotYRef = useRef<number>(0);

  // ----- Constants -----
  const ATTRACT_X = -30;
  const AUTO_SPEED = 15;     // degrees per second
  const DRAG_SPEED = 0.3;    // degrees per pixel
  const MAX_DT = 50;         // prevents tab-inactive jumps

  // ----- Helpers -----
  const applyTransform = () => {
    if (!cubeRef.current) return;
    cubeRef.current.style.transform =
      `rotateX(${rotXRef.current}deg) rotateY(${rotYRef.current}deg)`;
  };

  const stopRAF = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const startRAF = () => {
    stopRAF();
    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  };

  // ----- Animation loop (AUTO mode) -----
  const tick = (time: number) => {
    if (mode !== "AUTO") return;

    let dt = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // clamp dt to avoid huge jumps after tab inactivity
    dt = Math.min(dt, MAX_DT);

    rotXRef.current = ATTRACT_X;
    rotYRef.current += AUTO_SPEED * (dt / 1000);

    applyTransform();
    rafRef.current = requestAnimationFrame(tick);
  };

  // ----- Pointer handlers -----
  const onPointerDown = (e: React.PointerEvent) => {
    if (!cubeRef.current) return;

    setMode("DRAG");
    stopRAF();

    pointerIdRef.current = e.pointerId;
    cubeRef.current.setPointerCapture(e.pointerId);

    dragStartXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    dragStartRotXRef.current = rotXRef.current;
    dragStartRotYRef.current = rotYRef.current;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (mode !== "DRAG") return;
    if (pointerIdRef.current !== e.pointerId) return;

    const dx = e.clientX - dragStartXRef.current;
    const dy = e.clientY - dragStartYRef.current;

    rotYRef.current = dragStartRotYRef.current + dx * DRAG_SPEED;
    rotXRef.current = dragStartRotXRef.current - dy * DRAG_SPEED;

    applyTransform();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!cubeRef.current) return;
    if (pointerIdRef.current !== e.pointerId) return;

    try {
      cubeRef.current.releasePointerCapture(e.pointerId);
    } catch { }

    pointerIdRef.current = null;
    setMode("AUTO");
    startRAF();
  };

  // ----- Visibility handling -----
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        stopRAF();
      } else if (mode === "AUTO") {
        startRAF();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [mode]);

  // ----- Initial mount -----
  useEffect(() => {
    rotXRef.current = ATTRACT_X;
    rotYRef.current = 0;
    applyTransform();
    startRAF();

    return stopRAF;
  }, []);

  // ----- Render -----
  return (
    <div className="flex items-center justify-center py-24">
      <style>{`
        .scene {
          perspective: 900px;
        }
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
        .bottom { transform: rotateX(-90deg) translateZ(130px); background: #444444; }
      `}</style>

      <div className="scene">
        <div
          ref={cubeRef}
          className="cube cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
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
