"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

export default function RetakeWarning({
  message,
  resultHref,
  title,
  children,
}: {
  message: string;
  resultHref: string;
  title: string;
  children: ReactNode;
}) {
  const [proceed, setProceed] = useState(false);
  if (proceed) return children;

  return (
    <main className="vn-page" style={{ maxWidth: "42rem" }}>
      <p className="vn-eyebrow">{title}</p>
      <h1 className="vn-heading mb-6">Retake already?</h1>
      <div className="vn-card">
        <p className="vn-body">{message}</p>
        <p className="mt-6 flex flex-wrap items-center gap-4">
          <button className="vn-btn" onClick={() => setProceed(true)}>
            Continue anyway
          </button>
          <Link href={resultHref} className="vn-link">
            See your last result
          </Link>
        </p>
      </div>
    </main>
  );
}
