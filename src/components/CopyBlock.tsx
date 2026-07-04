"use client";

import { useRef, useState } from "react";

// コピーブロック（デザインプロンプト8章：ターミナル風・信号ドット・コピーボタン）
export function CopyBlock({
  label,
  text,
  footNote = "クリックでコピーできます",
}: {
  label: string;
  text: string;
  footNote?: string;
}) {
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  async function copy() {
    const value = bodyRef.current?.innerText ?? text;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // クリップボードAPIが使えない環境向けフォールバック
      const range = document.createRange();
      if (bodyRef.current) {
        range.selectNodeContents(bodyRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        document.execCommand("copy");
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="copy-block">
      <div className="copy-head">
        <div className="copy-dots">
          <span className="copy-dot red" />
          <span className="copy-dot yellow" />
          <span className="copy-dot green" />
          <span className="copy-label">{label}</span>
        </div>
        <button
          className={`copy-btn ${copied ? "copied" : ""}`}
          onClick={copy}
          type="button"
        >
          {copied ? "✓ コピーしました！" : "コピー"}
        </button>
      </div>
      <div className="copy-body" ref={bodyRef}>
        {text}
      </div>
      <div className="copy-foot">
        <span className="foot-icon">i</span>
        <span className="foot-text">{footNote}</span>
      </div>
    </div>
  );
}
