"use client";

import { useLayoutEffect, useRef, useState } from "react";

function Lotus() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <g fill="var(--terracotta)">
        <ellipse cx="50" cy="50" rx="10" ry="20" transform="rotate(0 50 50)" opacity="0.9" />
        <ellipse cx="50" cy="50" rx="10" ry="20" transform="rotate(45 50 50)" opacity="0.9" />
        <ellipse cx="50" cy="50" rx="10" ry="20" transform="rotate(90 50 50)" opacity="0.9" />
        <ellipse cx="50" cy="50" rx="10" ry="20" transform="rotate(135 50 50)" opacity="0.9" />
        <ellipse cx="50" cy="50" rx="10" ry="20" transform="rotate(-45 50 50)" opacity="0.9" />
        <ellipse cx="50" cy="50" rx="10" ry="20" transform="rotate(-90 50 50)" opacity="0.9" />
        <ellipse cx="50" cy="50" rx="10" ry="20" transform="rotate(-135 50 50)" opacity="0.9" />
        <ellipse cx="50" cy="50" rx="10" ry="20" transform="rotate(180 50 50)" opacity="0.9" />
      </g>
      <circle cx="50" cy="50" r="9" fill="var(--gold)" />
    </svg>
  );
}

interface ScaleSliderProps {
  steps?: number;
  value: number | null;
  onChange: (value: number) => void;
  labelLow?: string;
  labelHigh?: string;
}

export default function ScaleSlider({ steps = 6, value, onChange, labelLow, labelHigh }: ScaleSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const baseKnobSize = 48;
  const maxKnobSize = 64;

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    setTrackWidth(track.offsetWidth);

    const observer = new ResizeObserver((entries) => {
      setTrackWidth(entries[0].contentRect.width);
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const idx = value ?? Math.floor((steps - 1) / 2);

  // Step centers are evenly spaced across the full track width (not inset by
  // knob size), so the click target for each position stays the same size
  // regardless of how large the knob visually grows at the extremes.
  function centerForIdx(i: number) {
    if (!trackWidth) return 0;
    return ((i + 0.5) / steps) * trackWidth;
  }

  function snapIdx(clickX: number) {
    if (!trackWidth) return idx;
    const stepWidth = trackWidth / steps;
    return Math.max(0, Math.min(steps - 1, Math.floor(clickX / stepWidth)));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setDragging(true);
    const track = trackRef.current;

    function onMove(ev: PointerEvent) {
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const newIdx = snapIdx(ev.clientX - rect.left);
      onChange(newIdx);
    }
    function onUp() {
      setDragging(false);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
    }
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  }

  function onTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const newIdx = snapIdx(e.clientX - rect.left);
    onChange(newIdx);
    knobRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(steps - 1, idx + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(0, idx - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(steps - 1);
    }
  }

  // Distance from center, 0 at the middle, 1 at either extreme — drives lotus size.
  const center = (steps - 1) / 2;
  const distanceFromCenter = center > 0 ? Math.abs(idx - center) / center : 0;
  const knobSize = baseKnobSize + distanceFromCenter * (maxKnobSize - baseKnobSize);

  return (
    <div
      ref={trackRef}
      onClick={onTrackClick}
      className="relative cursor-pointer"
      style={{ height: 96, marginBottom: 8 }}
    >
      <div
        className="absolute left-0 right-0"
        style={{ top: "50%", height: 1, background: "var(--ink-faint)", transform: "translateY(-50%)" }}
      />
      {trackWidth > 0 && (
        <div
          role="slider"
          ref={knobRef}
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={steps - 1}
          aria-valuenow={idx}
          aria-valuetext={
            labelLow && labelHigh
              ? `${idx + 1} of ${steps}, closer to ${idx < (steps - 1) / 2 ? labelLow : labelHigh}`
              : `${idx + 1} of ${steps}`
          }
          aria-label={labelLow && labelHigh ? `Scale from ${labelLow} to ${labelHigh}` : "Scale"}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
          className="absolute flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{
            top: "50%",
            left: centerForIdx(idx),
            width: knobSize,
            height: knobSize,
            transform: "translate(-50%, -50%)",
            transition: dragging ? "none" : "left 0.22s cubic-bezier(0.34,1.56,0.64,1), width 0.22s, height 0.22s",
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
            outlineColor: "var(--gold)",
          }}
        >
          <Lotus />
        </div>
      )}
    </div>
  );
}
