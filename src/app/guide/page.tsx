import Link from "next/link";
import { Header, Footer } from "@/components/ui";

// S11 はじめてガイド（初心者向けHTMLマニュアル設計を活かした1ページ構成）
export default function GuidePage() {
  return (
    <div className="container">
      <p>
        <Link href="/home">← ホームにもどる</Link>
      </p>
      <Header
        title="📖 はじめてガイド"
        desc="はじめての方へ、スタンプができるまでをやさしく説明します"
        badge="使い方マニュアル"
      />

      {/* 1. スタンプができるまで */}
      <h2 className="section-title">🎨 スタンプができるまで</h2>
      <div className="card">
        {[
          { n: 1, t: "質問に答える", d: "5つのかんたんな質問に答えます（だれの・どんな雰囲気の…など）" },
          { n: 2, t: "写真を送る", d: "顔写真を1〜3枚アップします（写真なしで特徴を入力してもOK）" },
          { n: 3, t: "できた絵をチェック", d: "AIが描いたスタンプを1枚ずつ確認します。作り直しもできます" },
          { n: 4, t: "ダウンロードして申請", d: "申請に使えるサイズに変換したZIPをダウンロードします" },
        ].map((s, i, arr) => (
          <div className="step" key={s.n}>
            <div className="step-num">{s.n}</div>
            <div className="step-title">{s.t}</div>
            <p className="text-sub mb-0">{s.d}</p>
            <div className={`step-connect ${i === arr.length - 1 ? "last" : ""}`} />
          </div>
        ))}
      </div>

      {/* 2. 写真のコツ */}
      <h2 className="section-title">📷 きれいに作るための写真のコツ</h2>
      <div className="card">
        <div className="tip-item">
          <strong>正面を向いた写真</strong>：顔がまっすぐ写っていると似せやすくなります
        </div>
        <div className="tip-item">
          <strong>明るい場所で撮った写真</strong>：顔の特徴がはっきり分かります
        </div>
        <div className="tip-item">
          <strong>1人で写っている写真</strong>：他の人が写っていないものを選びましょう
        </div>
        <div className="tip-item">
          <strong>帽子・マスクなしがおすすめ</strong>：顔全体が見えると仕上がりが良くなります
        </div>
      </div>

      {/* 3. LINE申請のしかた */}
      <h2 className="section-title">📦 完成したあとのLINE申請のしかた</h2>
      <div className="card">
        {[
          { n: 1, t: "LINE Creators Marketに登録", d: "LINEの公式サイトでクリエイター登録をします" },
          { n: 2, t: "スタンプを登録", d: "ダウンロードした画像をアップロードして情報を入力します" },
          { n: 3, t: "審査を申請", d: "申請するとLINE社の審査が始まります" },
        ].map((s, i, arr) => (
          <div className="step" key={s.n}>
            <div className="step-num">{s.n}</div>
            <div className="step-title">{s.t}</div>
            <p className="text-sub mb-0">{s.d}</p>
            <div className={`step-connect ${i === arr.length - 1 ? "last" : ""}`} />
          </div>
        ))}
        <p className="mt-16">
          <a
            href="https://creator.line.me/ja/"
            target="_blank"
            rel="noopener noreferrer"
          >
            → LINE Creators Market（LINEの公式申請サイト）
          </a>
        </p>
        <div className="note-box">
          <strong>審査についての注意</strong>
          申請の審査はLINE社が行います。このアプリは審査の通過を保証するものではありません。
        </div>
      </div>

      <p className="center mt-24">
        <Link href="/home">← ホームにもどる</Link>
      </p>
      <Footer />
    </div>
  );
}
