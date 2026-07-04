import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 認証セッションのcookieを毎リクエストで更新しつつ、保護ルートを制御する。
// - 未ログインで保護ページ → /login へ
// - ログイン済みで /login・/register → /home へ
const PUBLIC_PATHS = ["/login", "/apply", "/error", "/maintenance"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  const isApi = path.startsWith("/api");

  // 認証系API（申請・ログイン）は未ログインでもアクセス可
  const isPublicApi =
    path.startsWith("/api/auth/apply") || path.startsWith("/api/auth/login");
  // その他のAPIは各Route Handlerが自前で認証を返す（HTMLリダイレクトを避け401にする）
  if (!user && isApi && !isPublicApi) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!user && !isPublic && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (path === "/login" || path === "/apply")) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // 静的ファイル・画像・APIのcron以外に適用
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
