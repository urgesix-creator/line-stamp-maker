"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header, SuccessBox, Footer } from "@/components/ui";

export function DownloadClient({
  projectId,
  costText,
  costMessage,
  showModalInitially,
}: {
  projectId: string;
  costText: string;
  costMessage: string;
  showModalInitially: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(showModalInitially);

  // 初回表示時のみモーダルを出す。表示したら「表示済み」を記録（F11）。
  useEffect(() => {
    if (showModalInitially) {
      fetch(`/api/projects/${projectId}/cost-shown`, { method: "POST" });
    }
  }, [showModalInitially, projectId]);

  // 金額を薄黄色ハイライトで強調するため、本文の金額部分を分割
  const parts = costMessage.split(costText);

  return (
    <div className="container">
      <Header
        title="📦 ダウンロード"
        desc="LINEスタンプ申請にそのまま使えるサイズに変換しました"
        badge="書き出し"
      />

      <SuccessBox>
        LINEスタンプ申請にそのまま使えるサイズに変換しました。
      </SuccessBox>

      {/* 内訳リスト */}
      <div className="card">
        <h2>📋 ファイルの内訳</h2>
        <div className="tip-item">
          <strong>01.png〜16.png</strong>：370×320px・透過・各1MB以下・内容の周囲に約10px余白
        </div>
        <div className="tip-item">
          <strong>main.png</strong>：240×240px（メイン画像）
        </div>
        <div className="tip-item">
          <strong>tab.png</strong>：96×74px（タブ画像）
        </div>
        <p className="text-sub mt-8">すべてPNG形式です。</p>
      </div>

      <a
        className="btn btn-primary btn-block"
        href={`/api/projects/${projectId}/download`}
      >
        ⬇ ZIPをダウンロード
      </a>

      {/* 費用の1行常設再掲（F11） */}
      <p className="text-sub mt-16">
        今回の作成費用：{costText}（AI画像生成ツールの利用料）
      </p>

      {/* 申請方法アコーディオン */}
      <details className="accordion card mt-16">
        <summary>LINEスタンプの申請方法（かんたん3ステップ）</summary>
        <div className="mt-8">
          <div className="tip-item">
            <strong>1. LINE Creators Marketに登録</strong>：LINEの公式サイトでクリエイター登録
          </div>
          <div className="tip-item">
            <strong>2. スタンプを登録</strong>：ダウンロードした画像をアップロード
          </div>
          <div className="tip-item">
            <strong>3. 審査を申請</strong>：申請するとLINE社の審査が始まります
          </div>
          <p className="mt-8">
            <a href="https://creator.line.me/ja/" target="_blank" rel="noopener noreferrer">
              → LINE Creators Market（LINEの公式申請サイト）
            </a>
          </p>
        </div>
      </details>

      <p className="text-sub">
        申請代行・審査通過の保証は本アプリの対象外です。
      </p>

      <p className="center mt-24">
        <Link href="/home">← ホームにもどる</Link>
      </p>
      <Footer />

      {/* 費用お知らせモーダル（F11・初回のみ） */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>💰 費用のお知らせ</h2>
            <p>
              {parts[0]}
              <span className="highlight">{costText}</span>
              {parts[1] ?? ""}
            </p>
            <button
              className="btn btn-primary btn-block mt-16"
              onClick={() => setModalOpen(false)}
            >
              とじる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
