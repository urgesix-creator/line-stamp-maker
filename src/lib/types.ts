import type { ProjectStatus, RequestKind } from "./constants";

// DBの各テーブルに対応するアプリ側の型（6章準拠）

export type Role = "admin" | "user";
export type UserState = "active" | "suspended" | "pending";

export interface Profile {
  id: string; // auth.users.id
  email: string;
  display_name: string;
  role: Role;
  state: UserState;
  monthly_set_limit: number;
  regen_limit: number;
  clothing_limit: number;
  created_at: string;
}

export type InviteState = "unused" | "registered" | "expired" | "revoked";

export interface Invite {
  id: string;
  label: string; // 管理用メモ
  token: string;
  state: InviteState;
  expires_at: string;
  created_at: string;
  used_at: string | null;
  registered_user_id: string | null;
}

export interface WizardAnswers {
  target: string; // self/family/...
  portraitConsent: boolean; // 肖像権確認
  hasPhoto: boolean;
  resemblance: string; // close/caricature/atmosphere
  mood: string; // work/casual/...
  textStyle: string; // handwritten/pop/round
  features?: {
    hair?: string;
    clothing?: string;
    atmosphere?: string;
    age?: string;
    expression?: string;
  };
  step?: number; // 中断復帰用の現在ステップ
}

export interface PhraseItem {
  no: number;
  text: string;
  color: string; // 色チップの値（HEX）またはラベル
}

export interface Project {
  id: string;
  owner_id: string;
  answers: WizardAnswers;
  phrases: PhraseItem[];
  status: ProjectStatus;
  regen_remaining: number;
  clothing_remaining: number;
  redo_used: boolean; // S5「雰囲気を変えてやり直す」無料枠(1回)使用済みか
  cost_notice_shown: boolean;
  created_at: string;
  completed_at: string | null;
}

export type ImageReviewState = "unconfirmed" | "ok" | "regen_requested";
export type ImageSlot = number | "main" | "tab"; // 1..16 / main / tab

export interface StampImage {
  id: string;
  project_id: string;
  slot: string; // "01".."16" / "main" / "tab"
  storage_path: string;
  review_state: ImageReviewState;
  regen_count: number;
  clothing_history: ClothingHistoryEntry[];
  prev_storage_path: string | null; // 直前1世代（元にもどす用）
  delete_after: string | null;
  updated_at: string;
}

export interface ClothingHistoryEntry {
  instruction: string;
  at: string;
  prev_path: string;
}

export interface UploadPhoto {
  id: string;
  project_id: string;
  storage_path: string;
  created_at: string;
  delete_after: string | null;
}

export type RequestState = "pending" | "approved" | "rejected";

export interface QuotaRequest {
  id: string;
  requester_id: string;
  project_id: string;
  kind: RequestKind;
  reason: string | null;
  state: RequestState;
  grant_count: number | null;
  reject_reason: string | null;
  created_at: string;
  processed_at: string | null;
  // join用
  requester_name?: string;
}

export interface GenLog {
  id: string;
  user_id: string;
  project_id: string;
  kind: string; // preview/main/regen/clothing
  success: boolean;
  created_at: string;
}

export interface AppSettings {
  id: number;
  price_per_image: number;
  price_per_clothing: number;
  cost_message: string;
  invite_template: string;
  invite_message: string;
}
