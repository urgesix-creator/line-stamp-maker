import Link from "next/link";
import { Header } from "@/components/ui";

// S10 404
export default function NotFound() {
  return (
    <div className="container narrow">
      <Header title="ページが見つかりませんでした" badge="お知らせ" />
      <div className="card center">
        <p className="text-sub">
          お探しのページは見つかりませんでした。
        </p>
        <Link className="btn btn-primary btn-block mt-16" href="/home">
          ホームへ戻る
        </Link>
      </div>
    </div>
  );
}
