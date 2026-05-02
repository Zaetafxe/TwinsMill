"use client";

import Image from "next/image";
import { useState } from "react";

type BrandLogoProps = {
  compact?: boolean;
  variant?: "default" | "auth";
};

export function BrandLogo({ compact = false, variant = "default" }: BrandLogoProps) {
  const logoCandidates =
    variant === "auth"
      ? ["/moltura-logo.svg", "/logo-oficial-clean.png", "/logo-dos.png"]
      : ["/logo-dos.png", "/logo-oficial-clean.png", "/logotres.png", "/Logo.png", "/logo.png", "/logo", "/logo.svg", "/moltura-logo.svg"];
  const [logoIndex, setLogoIndex] = useState(0);
  const [useFallback, setUseFallback] = useState(false);

  return (
    <div className={`brand-lockup ${compact ? "brand-lockup-compact" : ""} ${variant === "auth" ? "brand-lockup-auth" : ""}`}>
      {useFallback ? (
        <div className="brand-emblem" aria-hidden="true">
          <div className="brand-emblem-core" />
          <span className="brand-emblem-label">IA</span>
        </div>
      ) : (
        <div className={`brand-logo-frame ${compact ? "brand-logo-frame-compact" : ""}`}>
          <Image
            src={logoCandidates[logoIndex]}
            alt="Moltura"
            width={compact ? 56 : 88}
            height={compact ? 56 : 88}
            className="brand-logo-image"
            onError={() => {
              if (logoIndex < logoCandidates.length - 1) {
                setLogoIndex((index) => index + 1);
                return;
              }
              setUseFallback(true);
            }}
          />
        </div>
      )}

      {useFallback ? (
        <div>
          <p className="brand-wordmark">MOLTURA</p>
          <p className="brand-tagline">Molienda inteligente</p>
        </div>
      ) : null}
    </div>
  );
}
