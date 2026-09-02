"use client";

/* Native links intentionally avoid a client-router navigation bug seen in some classroom browsers. */
/* eslint-disable @next/next/no-html-link-for-pages */

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

interface NavbarProps {
  currentStudentKey?: string | null;
  onLogout?: () => void;
}

export function Navbar({ currentStudentKey, onLogout }: NavbarProps) {
  const pathname = usePathname();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Handle ESC key for modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && showLogoutConfirm) {
        setShowLogoutConfirm(false);
      }
    }
    if (showLogoutConfirm) {
      window.addEventListener("keydown", handleKeyDown);
      cancelBtnRef.current?.focus();
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLogoutConfirm]);

  async function handleConfirmLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/student/logout", { method: "POST" });
    } catch {
      // ignore network errors
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
      if (onLogout) onLogout();
    }
  }

  const activeStudent = currentStudentKey;

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3 gap-2">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5">
            <a
              href="/"
              className="flex items-center gap-2 font-bold text-slate-900 transition hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden rounded-lg p-1"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-base text-white shadow-2xs">
                🤖
              </span>
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-bold tracking-tight leading-tight">
                  알고리즘 워밍업
                </span>
                <span className="hidden sm:inline text-[10px] text-slate-500 font-normal">
                  아이디어 · 추천 · 체험
                </span>
              </div>
            </a>
          </div>

          {/* Navigation Links & Desktop Student Status */}
          <nav aria-label="메인 네비게이션" className="flex items-center gap-1 sm:gap-2">
            <a
              href="/write"
              aria-current={pathname.startsWith("/write") ? "page" : undefined}
              className={`rounded-lg px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden ${
                pathname.startsWith("/write")
                  ? "bg-blue-50 text-blue-700 font-bold shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              워밍업
            </a>

            <a
              href="/execute"
              aria-current={pathname.startsWith("/execute") ? "page" : undefined}
              className={`rounded-lg px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden ${
                pathname.startsWith("/execute")
                  ? "bg-emerald-50 text-emerald-700 font-bold shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              체험
            </a>

            <a
              href="/teacher"
              aria-current={pathname.startsWith("/teacher") ? "page" : undefined}
              className={`rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:outline-hidden ${
                pathname.startsWith("/teacher")
                  ? "bg-slate-900 text-white font-bold shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              교사용
            </a>

            {/* Desktop Student Session Badge & Logout */}
            {activeStudent && (
              <div className="ml-2 hidden items-center gap-2 border-l border-slate-200 pl-3 md:flex">
                <div
                  className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 font-medium"
                  title={`현재 접속 학생: ${activeStudent}`}
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  <span className="max-w-[140px] truncate">{activeStudent}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-hidden"
                  aria-label={`${activeStudent} 학생 세션 종료 (로그아웃)`}
                >
                  세션 종료
                </button>
              </div>
            )}
          </nav>
        </div>

        {/* Mobile Student Session Strip (< md) */}
        {activeStudent && (
          <div
            role="region"
            aria-label="모바일 접속 세션 정보"
            className="flex items-center justify-between border-t border-slate-100 bg-slate-50/95 px-3 py-1.5 text-xs text-slate-600 md:hidden"
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
              <span className="text-[11px] text-slate-500">접속:</span>
              <strong className="text-slate-800 truncate font-semibold">{activeStudent}</strong>
            </div>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="ml-2 shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-hidden"
              aria-label={`${activeStudent} 학생 세션 종료 (로그아웃)`}
            >
              세션 종료
            </button>
          </div>
        )}
      </header>

      {/* Accessible Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-modal-title"
          aria-describedby="logout-modal-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl text-amber-600">
                🔒
              </div>
              <div>
                <h2 id="logout-modal-title" className="text-base font-bold text-slate-900">
                  세션을 종료하시겠습니까?
                </h2>
                <p id="logout-modal-desc" className="text-xs text-slate-500 mt-0.5">
                  현재 학생: <strong className="text-slate-800">{activeStudent}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
              제출 완료된 과제와 실행 기록은 서버에 안전하게 보관됩니다. 다른 학생으로 전환하거나 수업을 마칠 때 세션을 종료하세요.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden"
              >
                계속 진행하기
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                disabled={isLoggingOut}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-hidden"
              >
                {isLoggingOut ? "종료 중..." : "세션 종료 (로그아웃)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
