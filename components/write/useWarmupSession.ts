"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoundInfo, MySubmission } from "./types";

// The 4-step flow is split across separate routes, each mounting its own
// `useWarmupSession()` instance — without this module-level guard, the
// "이전 세션이 복구되었습니다" notice (meant for a real page reload/revisit)
// would fire again on every ordinary navigation between /write,
// /write/algorithm, and /write/explore. A plain module variable is enough:
// it resets on a real reload/new tab, but survives client-side navigation
// within the same page session.
let hasShownSessionRestoredNotice = false;

export function useWarmupSession() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [studentLabel, setStudentLabel] = useState<string | null>(null);
  const [round, setRound] = useState<RoundInfo | null>(null);
  const [mySubmission, setMySubmission] = useState<MySubmission | null>(null);
  const [sessionRestoredNotice, setSessionRestoredNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadRound = useCallback(async (): Promise<{ ok: boolean; hadSubmission: boolean }> => {
    const res = await fetch("/api/warmup/round");
    if (res.status === 401) {
      setLoggedIn(false);
      return { ok: false, hadSubmission: false };
    }
    const data = (await res.json()) as {
      studentKey?: string;
      round: RoundInfo | null;
      mySubmission: MySubmission | null;
    };
    setLoggedIn(true);
    if (data.studentKey) setStudentLabel(data.studentKey);
    setRound(data.round);
    setMySubmission(data.mySubmission);
    return { ok: true, hadSubmission: Boolean(data.mySubmission) };
  }, []);

  // On mount, check session
  useEffect(() => {
    let ignore = false;
    const timer = window.setTimeout(() => {
      loadRound()
        .then(({ ok, hadSubmission }) => {
          if (ignore) return;
          if (ok && hadSubmission && !hasShownSessionRestoredNotice) {
            hasShownSessionRestoredNotice = true;
            setSessionRestoredNotice(true);
            window.setTimeout(() => setSessionRestoredNotice(false), 4000);
          }
        })
        .catch(() => {
          // treat as logged out
        })
        .finally(() => {
          if (!ignore) setCheckingSession(false);
        });
    }, 0);
    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [loadRound]);

  // Poll while waiting for teacher to publish round
  useEffect(() => {
    if (checkingSession || !loggedIn || round) return;
    const interval = window.setInterval(() => {
      loadRound().catch(() => {});
    }, 3500);
    return () => window.clearInterval(interval);
  }, [checkingSession, loggedIn, round, loadRound]);

  async function handleLogin(school: string, studentId: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school, studentId, consent: true }),
      });
      const data = (await res.json()) as { studentKey?: string; error?: string };
      if (!res.ok || !data.studentKey) throw new Error(data.error ?? "로그인에 실패했습니다.");
      setStudentLabel(data.studentKey);
      await loadRound();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoggedIn(false);
    setRound(null);
    setMySubmission(null);
    // A different student may log in next on the same shared device/tab —
    // let them see their own "session restored" notice if it applies to them.
    hasShownSessionRestoredNotice = false;
    try {
      await fetch("/api/student/logout", { method: "POST" });
    } catch {
      // ignore
    }
  }

  return {
    checkingSession,
    loggedIn,
    studentLabel,
    round,
    mySubmission,
    setMySubmission,
    sessionRestoredNotice,
    setSessionRestoredNotice,
    loadRound,
    handleLogin,
    handleLogout,
    error,
    setError,
    loading,
    setLoading,
  };
}
