"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ImageState {
  slot: string;
  review_state: "unconfirmed" | "ok" | "regen_requested";
  hasPrev: boolean;
  url: string | null;
}
export interface ProjectStatusData {
  status: string;
  regen_remaining: number;
  clothing_remaining: number;
  redo_used: boolean;
  cost_notice_shown: boolean;
  pendingKinds: string[];
  images: ImageState[];
}

// S5/S6 用の状況ポーリングフック。生成中は自動でポーリングを続ける。
export function useProjectStatus(projectId: string, pollMs = 4000) {
  const [data, setData] = useState<ProjectStatusData | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/status`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as ProjectStatusData;
      setData(json);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, pollMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh, pollMs]);

  return { data, refresh };
}
