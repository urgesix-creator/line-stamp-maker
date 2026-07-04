"use client";

import { useEffect, useState } from "react";

// 完成お祝い演出（F13）：CSSのみ・約1.5秒・4色紙片。
// prefers-reduced-motion 有効時は表示しない（CSS側で display:none、かつJSでも生成しない）。
const COLORS = ["#E86C3A", "#FFD700", "#2E8B57", "#FF69B4"]; // アクセント/金/緑/ピンク

export function Confetti({ onDone }: { onDone?: () => void }) {
  const [pieces, setPieces] = useState<
    { left: number; delay: number; color: string; dur: number }[]
  >([]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      onDone?.();
      return;
    }
    // 60片を生成（位置・色・落下時間をずらす）
    const arr = Array.from({ length: 60 }, (_, i) => ({
      left: (i * 137) % 100,
      delay: (i % 10) * 0.05,
      color: COLORS[i % COLORS.length],
      dur: 1.2 + (i % 5) * 0.08,
    }));
    setPieces(arr);
    const t = setTimeout(() => onDone?.(), 1600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <>
      <div className="confetti-layer" aria-hidden="true">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              borderRadius: i % 2 ? "50%" : "2px",
            }}
          />
        ))}
      </div>
      <div className="celebrate-text" role="status">
        完成おめでとうございます！🎉
      </div>
    </>
  );
}
