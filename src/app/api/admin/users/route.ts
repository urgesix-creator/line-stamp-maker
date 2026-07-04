import { NextResponse } from "next/server";
import { getAdminOrNull } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";

// ユーザー管理（S8）：利用申請の承認（state='active'＋回数付与）・上限変更・
// 停止/再開・あいことばリセット。
export async function PATCH(req: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json()) as {
    userId: string;
    monthly_set_limit?: number;
    regen_limit?: number;
    clothing_limit?: number;
    state?: "active" | "suspended";
    newPassphrase?: string;
  };
  if (!body.userId)
    return NextResponse.json({ error: "対象がありません" }, { status: 400 });

  const db = createAdminClient();

  // あいことば（パスワード）のリセット
  if (body.newPassphrase) {
    if (body.newPassphrase.length < 4)
      return NextResponse.json({ error: "4文字以上にしてください" }, { status: 400 });
    const { error: pwErr } = await db.auth.admin.updateUserById(body.userId, {
      password: body.newPassphrase,
    });
    if (pwErr) {
      console.error("[admin.users.pass]", pwErr);
      return NextResponse.json({ error: "変更に失敗しました" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const patch: Record<string, unknown> = {};
  for (const k of [
    "monthly_set_limit",
    "regen_limit",
    "clothing_limit",
    "state",
  ] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "変更内容がありません" }, { status: 400 });

  const { error } = await db.from("profiles").update(patch).eq("id", body.userId);
  if (error) {
    console.error("[admin.users]", error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// 利用申請の却下＝アカウント削除（承認待ちユーザーの整理）。
export async function DELETE(req: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { userId } = (await req.json()) as { userId: string };
  if (!userId) return NextResponse.json({ error: "対象がありません" }, { status: 400 });

  const db = createAdminClient();
  // profiles・関連データは auth ユーザー削除のカスケードで消える
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[admin.users.delete]", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
