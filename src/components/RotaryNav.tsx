"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface DialItem {
  key: string;
  label: string;
  fullLabel: string;
  href: string;
  complete: boolean;
}

// A rotating compass dial. Only the upper half of the ring is shown. The items
// are spaced evenly around the full circle, so with five items exactly three
// (previous / current / next) are always on the visible half and the dial wraps
// around forever. The terracotta needle at 12 o'clock is fixed; the lotus is
// the hub and the home button.
const NAV_HEIGHT = 210;
const VB_W = 400;
const VB_H = 210;
const CX = 200; // dial pivot (the lotus)
const CY = 168;
const R = 150; // ring radius
const HUB_R = 40;
const LABEL_R = 106; // radius of the active label
const LABEL_R_SIDE = 88; // radius of the neighbours' labels (tucked inside the ring)
const DRAG_THRESHOLD = 6; // px before a tap becomes a drag

const mod = (a: number, b: number) => ((a % b) + b) % b;

// Opacity by distance (in items) from the needle: 1 at the needle, 0.62 one
// item away, gone by 1.5 items.
function fade(d: number) {
  if (d >= 1.5) return 0;
  if (d <= 1) return 1 - 0.38 * d;
  return (0.62 * (1.5 - d)) / 0.5;
}

export default function RotaryNav({ items }: { items: DialItem[] }) {
  const router = useRouter();
  const n = items.length;
  const STEP = 360 / n;

  const [rot, setRot] = useState(-Math.floor(n / 2) * STEP);
  const rotRef = useRef(rot);
  const raf = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<{ startX: number; startRot: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    [],
  );

  function stopAnimation() {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }

  function setRotation(value: number) {
    rotRef.current = value;
    setRot(value);
  }

  function animateTo(target: number) {
    stopAnimation();
    const tick = () => {
      const diff = target - rotRef.current;
      if (Math.abs(diff) < 0.05) {
        setRotation(target);
        raf.current = null;
        return;
      }
      setRotation(rotRef.current + diff * 0.17);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  const liveIndex = Math.round(-rot / STEP); // unbounded; the wrapped value is the item
  const current = mod(liveIndex, n);

  function select(i: number) {
    if (suppressClick.current) return;
    if (i === current) {
      router.push(items[i].href);
      return;
    }
    // Shortest way round to reach item i.
    let delta = mod(i - current, n);
    if (delta > n / 2) delta -= n;
    animateTo(-(liveIndex + delta) * STEP);
  }

  function step(delta: number) {
    animateTo(-(Math.round(-rotRef.current / STEP) + delta) * STEP);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    stopAnimation();
    gesture.current = { startX: e.clientX, startRot: rotRef.current, moved: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.startX;
    if (!g.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      g.moved = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const rect = svgRef.current?.getBoundingClientRect();
    const scale = rect ? Math.min(rect.width / VB_W, rect.height / VB_H) : 1;
    // Pointer travel along the ring -> degrees, so the dial follows the finger.
    setRotation(g.startRot + (dx / scale / R) * (180 / Math.PI));
  }

  function endGesture(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.moved) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 0);
    setDragging(false);
    animateTo(-Math.round(-rotRef.current / STEP) * STEP);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  }

  // Ticks every 3 degrees around the full circle, skipping the item positions.
  const ticks: { a: number; major: boolean }[] = [];
  for (let a = 0; a < 360; a += 3) {
    if (Math.abs(mod(a + STEP / 2, STEP) - STEP / 2) < 0.01) continue;
    ticks.push({ a, major: a % 12 === 0 });
  }

  const positioned = items.map((item, i) => {
    const theta = mod(i * STEP + rot + 180, 360) - 180; // degrees from the needle, -180..180
    const d = Math.abs(theta) / STEP;
    const focus = Math.max(0, 1 - d);
    const radius = LABEL_R - (LABEL_R - LABEL_R_SIDE) * Math.min(1, d);
    const rad = (theta * Math.PI) / 180;
    return {
      item,
      i,
      d,
      focus,
      opacity: fade(d),
      x: CX + Math.sin(rad) * radius,
      y: CY - Math.cos(rad) * radius,
    };
  });

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 border-t"
      style={{ height: NAV_HEIGHT, overflow: "hidden", background: "var(--sand)", borderColor: "var(--ink-faint)" }}
    >
      <div
        role="group"
        aria-label="Assessments"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onKeyDown={onKeyDown}
        className="mx-auto h-full max-w-md select-none"
        style={{ touchAction: "pan-y", cursor: dragging ? "grabbing" : "grab" }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMax meet"
          width="100%"
          height="100%"
          style={{
            display: "block",
            WebkitMaskImage: "linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)",
            maskImage: "linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)",
          }}
        >
          <defs>
            <clipPath id="rotary-upper-half">
              <rect x={0} y={0} width={VB_W} height={CY} />
            </clipPath>
          </defs>

          {/* Fixed half-circle ring */}
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            stroke="var(--ink-faint)"
            strokeWidth={1}
          />

          {/* Turning ticks and item markers, clipped to the upper half */}
          <g clipPath="url(#rotary-upper-half)" pointerEvents="none">
            <g transform={`rotate(${rot} ${CX} ${CY})`}>
              {ticks.map(({ a, major }) => (
                <line
                  key={a}
                  x1={CX}
                  y1={CY - R}
                  x2={CX}
                  y2={CY - R + (major ? 9 : 5)}
                  stroke="var(--ink-faint)"
                  strokeWidth={major ? 1.1 : 0.8}
                  transform={`rotate(${a} ${CX} ${CY})`}
                />
              ))}
              {positioned.map(({ item, i, focus }) => {
                const accent = item.complete ? "var(--green-text)" : "var(--ink-faint)";
                return (
                  <circle
                    key={item.key}
                    cx={CX}
                    cy={CY - R}
                    r={3 + 1.4 * focus}
                    fill={item.complete ? accent : "var(--sand)"}
                    stroke={accent}
                    strokeWidth={1.2}
                    transform={`rotate(${i * STEP} ${CX} ${CY})`}
                  />
                );
              })}
            </g>
          </g>

          {/* Labels stay upright and travel along the arc */}
          {positioned.map(({ item, i, d, focus, opacity, x, y }) => (
            <g
              key={item.key}
              role="button"
              tabIndex={opacity > 0.1 ? 0 : -1}
              aria-label={i === current ? `Open ${item.fullLabel}` : `Turn to ${item.fullLabel}`}
              aria-current={i === current ? "true" : undefined}
              style={{ cursor: "pointer", outline: "none", opacity, pointerEvents: opacity > 0.1 ? "auto" : "none" }}
              onClick={() => select(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select(i);
                }
              }}
            >
              <rect x={x - 58} y={y - 26} width={116} height={54} fill="transparent" />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                fill="var(--ink)"
                style={{ fontFamily: '"Cormorant", serif', fontSize: 14 + 8 * focus }}
              >
                {item.label}
              </text>
              <text
                x={x}
                y={y + 22}
                textAnchor="middle"
                fill={item.complete ? "var(--green-text)" : "var(--ink-dim)"}
                fontSize={9.5}
                letterSpacing={1.8}
                style={{ fontFamily: '"Jost", sans-serif', opacity: Math.max(0, 1 - 2 * d) }}
              >
                {item.complete ? "COMPLETE" : "NOT STARTED"}
              </text>
            </g>
          ))}

          {/* Fixed needle at 12 o'clock */}
          <path d={`M ${CX - 5} 4 L ${CX + 5} 4 L ${CX} 14 Z`} fill="var(--terracotta)" />

          {/* Hub: the lotus, sized to the compass, is the home button */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Home"
            style={{ cursor: "pointer", outline: "none" }}
            onClick={() => router.push("/")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push("/");
              }
            }}
          >
            <circle cx={CX} cy={CY} r={HUB_R} fill="var(--sand)" stroke="var(--ink-faint)" strokeWidth={1} />
            <g transform={`translate(${CX} ${CY}) scale(1.5) translate(-50 -50)`}>
              <g fill="var(--terracotta)" opacity={0.9}>
                {[0, 45, 90, 135].map((deg) => (
                  <ellipse key={deg} cx="50" cy="50" rx="9" ry="20" transform={`rotate(${deg} 50 50)`} />
                ))}
              </g>
              <circle cx="50" cy="50" r="9" fill="var(--gold)" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
