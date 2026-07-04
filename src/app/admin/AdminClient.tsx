"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionTitle, NoteBox } from "@/components/ui";
import type { AppSettings, Profile, QuotaRequest } from "@/lib/types";

const KIND_LABEL: Record<string, string> = {
  clothing: "服装変更",
  regen: "再生成",
  monthly: "月間セット",
};

export function AdminClient({
  pendingUsers,
  pending,
  history,
  users,
  settings,
}: {
  pendingUsers: Profile[];
  pending: QuotaRequest[];
  history: QuotaRequest[];
  users: Profile[];
  settings: AppSettings;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <>
      {/* ── セクション1：承認待ちの利用申請（新規ユーザー） ── */}
      <SectionTitle>承認待ちの利用申請（{pendingUsers.length}件）</SectionTitle>
      {pendingUsers.length === 0 ? (
        <div className="card">
          <p className="text-sub mb-0">承認待ちの利用申請はありません</p>
        </div>
      ) : (
        pendingUsers.map((u) => (
          <PendingUserCard key={u.id} user={u} onDone={refresh} />
        ))
      )}

      {/* ── セクション2：追加枠の申請（既存ユーザーの回数追加） ── */}
      <SectionTitle>追加枠の申請（{pending.length}件）</SectionTitle>
      {pending.length === 0 ? (
        <div className="card">
          <p className="text-sub mb-0">承認待ちの追加申請はありません</p>
        </div>
      ) : (
        pending.map((r) => <QuotaCard key={r.id} req={r} onDone={refresh} />)
      )}
      <HistoryBlock history={history} />

      {/* ── セクション3：ユーザー一覧 ── */}
      <SectionTitle>ユーザー一覧</SectionTitle>
      <UsersSection users={users} onChange={refresh} />

      {/* ── セクション4：アプリ設定 ── */}
      <SectionTitle>アプリ設定</SectionTitle>
      <SettingsSection settings={settings} onChange={refresh} />
    </>
  );
}

// ── 利用申請カード（新規ユーザーの承認：回数を指定して付与 / 却下） ──
function PendingUserCard({ user, onDone }: { user: Profile; onDone: () => void }) {
  const [grant, setGrant] = useState(2);
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        state: "active",
        monthly_set_limit: grant,
      }),
    });
    setBusy(false);
    onDone();
  }

  async function reject() {
    if (!confirm(`「${user.display_name}」さんの申請を却下し、アカウントを削除します。よろしいですか？`))
      return;
    setBusy(true);
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    setBusy(false);
    onDone();
  }

  return (
    <div className="card">
      <div className="row between">
        <strong>{user.display_name}</strong>
        <span className="status-badge">利用申請</span>
      </div>
      <p className="text-sub">申請日時：{new Date(user.created_at).toLocaleString("ja-JP")}</p>
      <div className="row wrap" style={{ gap: 10 }}>
        <label className="row" style={{ gap: 6 }}>
          作れるセット数（月）
          <input
            type="number"
            className="input"
            style={{ width: 80 }}
            value={grant}
            min={1}
            onChange={(e) => setGrant(Number(e.target.value))}
          />
        </label>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={approve}>
          承認する（月{grant}セット）
        </button>
        <button className="btn btn-danger btn-sm" disabled={busy} onClick={reject}>
          却下する
        </button>
      </div>
    </div>
  );
}

// ── 追加枠の申請カード（既存ユーザー・F10） ──
function QuotaCard({ req, onDone }: { req: QuotaRequest; onDone: () => void }) {
  const [grant, setGrant] = useState(3);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    await fetch("/api/admin/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: req.id, action, grantCount: grant, rejectReason }),
    });
    setBusy(false);
    onDone();
  }

  return (
    <div className="card">
      <div className="row between">
        <strong>{req.requester_name}</strong>
        <span className="status-badge">{KIND_LABEL[req.kind]}</span>
      </div>
      <p className="text-sub">
        申請理由：{req.reason || "（記入なし）"}
        <br />
        申請日時：{new Date(req.created_at).toLocaleString("ja-JP")}
      </p>
      {!rejectMode ? (
        <div className="row wrap" style={{ gap: 10 }}>
          <label className="row" style={{ gap: 6 }}>
            付与回数
            <input
              type="number"
              className="input"
              style={{ width: 80 }}
              value={grant}
              min={1}
              onChange={(e) => setGrant(Number(e.target.value))}
            />
          </label>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act("approve")}>
            承認する（＋{grant}回）
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => setRejectMode(true)}>
            却下する
          </button>
        </div>
      ) : (
        <div className="stack">
          <textarea
            className="textarea"
            placeholder="却下理由（任意）"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setRejectMode(false)}>
              もどる
            </button>
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => act("reject")}>
              却下を確定
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryBlock({ history }: { history: QuotaRequest[] }) {
  return (
    <details className="accordion card">
      <summary>追加申請の履歴（直近90日）</summary>
      <div className="mt-8">
        {history.length === 0 ? (
          <p className="text-sub mb-0">処理済みの申請はありません</p>
        ) : (
          history.slice(0, 100).map((r) => (
            <div className="tip-item" key={r.id}>
              <strong>{r.requester_name}</strong> / {KIND_LABEL[r.kind]} /{" "}
              {r.state === "approved" ? `承認（＋${r.grant_count}回）` : "却下"}
              {r.reject_reason ? `（${r.reject_reason}）` : ""} /{" "}
              {r.processed_at ? new Date(r.processed_at).toLocaleString("ja-JP") : ""}
            </div>
          ))
        )}
      </div>
    </details>
  );
}

// ── ユーザーセクション ──
function UsersSection({ users, onChange }: { users: Profile[]; onChange: () => void }) {
  if (users.length === 0)
    return (
      <div className="card">
        <p className="text-sub mb-0">まだ承認済みのユーザーがいません</p>
      </div>
    );
  return (
    <div className="stack">
      {users.map((u) => (
        <UserRow key={u.id} user={u} onChange={onChange} />
      ))}
    </div>
  );
}

function UserRow({ user, onChange }: { user: Profile; onChange: () => void }) {
  const [monthly, setMonthly] = useState(user.monthly_set_limit);
  const [regen, setRegen] = useState(user.regen_limit);
  const [clothing, setClothing] = useState(user.clothing_limit);
  const [busy, setBusy] = useState(false);

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, ...patch }),
    });
    setBusy(false);
    onChange();
  }

  function toggleState() {
    const next = user.state === "active" ? "suspended" : "active";
    if (next === "suspended") {
      if (!confirm(`${user.display_name}さんはログインできなくなります。よろしいですか？`)) return;
    }
    save({ state: next });
  }

  async function resetPass() {
    const np = prompt(`${user.display_name}さんの新しいあいことば（4文字以上）を入力してください`);
    if (!np) return;
    if (np.length < 4) {
      alert("4文字以上にしてください");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, newPassphrase: np }),
    });
    setBusy(false);
    if (res.ok) alert(`あいことばを変更しました。本人に「${np}」を伝えてください。`);
    else alert("変更に失敗しました");
  }

  return (
    <div className="card">
      <div className="row between wrap">
        <div>
          <strong>{user.display_name}</strong>
          {user.role === "admin" && <span className="status-badge"> 管理者</span>}
        </div>
        <span className={`status-badge ${user.state === "active" ? "done" : "expired"}`}>
          {user.state === "active" ? "利用中" : "停止中"}
        </span>
      </div>
      <div className="row wrap mt-8" style={{ gap: 10 }}>
        <label className="row" style={{ gap: 4, fontSize: 13 }}>
          月間
          <input type="number" className="input" style={{ width: 64 }} value={monthly} min={0}
            onChange={(e) => setMonthly(Number(e.target.value))} />
        </label>
        <label className="row" style={{ gap: 4, fontSize: 13 }}>
          再生成
          <input type="number" className="input" style={{ width: 64 }} value={regen} min={0}
            onChange={(e) => setRegen(Number(e.target.value))} />
        </label>
        <label className="row" style={{ gap: 4, fontSize: 13 }}>
          服装
          <input type="number" className="input" style={{ width: 64 }} value={clothing} min={0}
            onChange={(e) => setClothing(Number(e.target.value))} />
        </label>
        <button
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={() => save({ monthly_set_limit: monthly, regen_limit: regen, clothing_limit: clothing })}
        >
          上限を変更
        </button>
        {user.role !== "admin" && (
          <>
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={resetPass}>
              あいことば変更
            </button>
            <button className="btn btn-danger btn-sm" onClick={toggleState}>
              {user.state === "active" ? "停止する" : "再開する"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── 設定セクション（費用単価・費用文言のみ。招待メッセージは廃止） ──
function SettingsSection({ settings, onChange }: { settings: AppSettings; onChange: () => void }) {
  const [s, setS] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price_per_image: s.price_per_image,
        price_per_clothing: s.price_per_clothing,
        cost_message: s.cost_message,
      }),
    });
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onChange();
  }

  return (
    <div className="card">
      <div className="row wrap" style={{ gap: 16 }}>
        <div className="field">
          <label>通常生成（円/枚）</label>
          <input type="number" className="input" style={{ width: 120 }} value={s.price_per_image}
            onChange={(e) => setS({ ...s, price_per_image: Number(e.target.value) })} />
        </div>
        <div className="field">
          <label>服装変更（円/回）</label>
          <input type="number" className="input" style={{ width: 120 }} value={s.price_per_clothing}
            onChange={(e) => setS({ ...s, price_per_clothing: Number(e.target.value) })} />
        </div>
      </div>
      <div className="field">
        <label>費用お知らせの文言（金額は {"{amount}"} に入ります）</label>
        <textarea className="textarea" value={s.cost_message}
          onChange={(e) => setS({ ...s, cost_message: e.target.value })} />
      </div>
      {saved && <NoteBox>保存しました</NoteBox>}
      <button className="btn btn-primary" disabled={busy} onClick={save}>
        設定を保存
      </button>
    </div>
  );
}
