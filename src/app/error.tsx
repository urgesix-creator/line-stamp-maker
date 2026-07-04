"use client";

import Link from "next/link";

// S10 500系エラー画面
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container narrow">
      <header className="header">
        <span className="badge">お知らせ</span>
        <h1>ただいま混み合っています</h1>
      </header>
      <div className="card center">
        <p className="text-sub">
          少し時間をおいてお試しください。
        </p>
        <div className="row mt-16" style={{ justifyContent: "center", gap: 12 }}>
          <button className="btn btn-outline" onClick={reset}>
            もう一度
          </button>
          <Link className="btn btn-primary" href="/home">
            ホームへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
