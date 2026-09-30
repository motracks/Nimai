"use client";

import { useEffect, useRef, useState } from "react";
import type { Timeline } from "@/lib/timeline";

const H = 220;
const TOP = 10;
const BOTTOM = 26;
const LEFT = 34;
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });

// Direct end labels, nudged apart so they never overlap.
function endLabels(ys: number[], gap = 14): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) order[k].y = Math.max(order[k].y, order[k - 1].y + gap);
  const overflow = order.length ? order[order.length - 1].y - (H - BOTTOM) : 0;
  if (overflow > 0) order.forEach((o) => (o.y -= overflow));
  const out = new Array<number>(ys.length);
  order.forEach((o) => (out[o.i] = o.y));
  return out;
}

export default function ProgressChart({ data, title }: { data: Timeline; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Draw at the container's real width so text stays at its true size on a phone.
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // End labels need room; on narrow screens the legend, tooltip and table carry identity.
  const direct = data.series.length <= 4 && W >= 420;
  const right = direct ? 96 : 14;
  const plotW = W - LEFT - right;
  const plotH = H - TOP - BOTTOM;

  const times = data.dates.map((d) => new Date(d).getTime());
  const t0 = times[0];
  const span = Math.max(times[times.length - 1] - t0, 1);
  const x = (i: number) => LEFT + ((times[i] - t0) / span) * plotW;
  const y = (v: number) => TOP + (1 - v / 100) * plotH;
  const last = data.dates.length - 1;
  const labelYs = endLabels(data.series.map((s) => y(s.values[last]) + 4));

  function nearest(clientX: number) {
    const box = svgRef.current!.getBoundingClientRect();
    const vx = ((clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i <= last; i++) if (Math.abs(x(i) - vx) < Math.abs(x(best) - vx)) best = i;
    setHover(best);
  }

  const unit = data.measure === "share" ? "%" : "";

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="sr-only">{title}</figcaption>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--ink-mid)" }} aria-label="Legend">
        {data.series.map((s) => (
          <li key={s.dim} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>

      <div ref={wrapRef} className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full touch-none select-none"
          role="img"
          aria-label={`${title}: line chart, ${data.dates.length} results. Use left and right arrow keys to step through them.`}
          tabIndex={0}
          onPointerMove={(e) => nearest(e.clientX)}
          onPointerDown={(e) => nearest(e.clientX)}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setHover((h) => Math.min((h ?? -1) + 1, last));
            if (e.key === "ArrowLeft") setHover((h) => Math.max((h ?? last + 1) - 1, 0));
          }}
        >
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={LEFT} x2={LEFT + plotW} y1={y(v)} y2={y(v)} stroke="var(--sand-dim)" strokeWidth={1} />
              <text x={LEFT - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--ink-dim)">
                {v}
                {unit}
              </text>
            </g>
          ))}
          {[0, last].map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : "end"} fontSize={11} fill="var(--ink-dim)">
              {fmt(data.dates[i])}
            </text>
          ))}

          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={TOP} y2={TOP + plotH} stroke="var(--ink-faint)" strokeWidth={1} />}

          {data.series.map((s) => (
            <g key={s.dim}>
              <polyline
                points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 4} fill={s.color} stroke="var(--card)" strokeWidth={2} />
              ))}
            </g>
          ))}

          {direct &&
            data.series.map((s, k) => (
              <text key={s.dim} x={LEFT + plotW + 8} y={labelYs[k]} fontSize={12} fill="var(--ink-mid)">
                {s.label} {s.values[last]}
                {unit}
              </text>
            ))}
        </svg>

        {hover != null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded-md border px-3 py-2 text-xs shadow-sm"
            style={{
              background: "var(--card)",
              borderColor: "var(--sand-dim)",
              color: "var(--ink)",
              left: `${(x(hover) / W) * 100}%`,
              transform: x(hover) > W / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
            }}
          >
            <p className="mb-1" style={{ color: "var(--ink-mid)" }}>
              {fmt(data.dates[hover])}
            </p>
            {data.series.map((s) => (
              <p key={s.dim} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="tabular-nums">
                  {s.values[hover]}
                  {unit}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      <details className="text-xs" style={{ color: "var(--ink-mid)" }}>
        <summary className="cursor-pointer" style={{ color: "var(--green-text)" }}>
          Show as a table
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left tabular-nums">
            <thead>
              <tr>
                <th className="py-1 pr-3 font-normal" style={{ color: "var(--ink-dim)" }}>
                  Date
                </th>
                {data.series.map((s) => (
                  <th key={s.dim} className="py-1 pr-3 font-normal" style={{ color: "var(--ink-dim)" }}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.dates.map((d, i) => (
                <tr key={d} style={{ borderTop: "1px solid var(--sand-dim)" }}>
                  <td className="py-1 pr-3">{fmt(d)}</td>
                  {data.series.map((s) => (
                    <td key={s.dim} className="py-1 pr-3">
                      {s.values[i]}
                      {unit}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
