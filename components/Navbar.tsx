"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavbarProps {
  currentStudentKey?: string | null;
  onLogout?: () => void;
}

export function Navbar({ currentStudentKey, onLogout }: NavbarProps) {
  const pathname = usePathname();
  const [storedStudent, setStoredStudent] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setStoredStudent(sessionStorage.getItem("algo_student_key"));
      } catch {
        // ignore storage errors
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (currentStudentKey) {
      try {
        sessionStorage.setItem("algo_student_key", currentStudentKey);
      } catch {
        // ignore storage errors
      }
    }
  }, [currentStudentKey]);

  function handleLogout() {
    try {
      sessionStorage.removeItem("algo_student_key");
    } catch {
      // ignore storage errors
    }
    setStoredStudent(null);
    if (onLogout) onLogout();
  }

  const activeStudent = currentStudentKey || storedStudent;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-slate-900 transition hover:text-blue-600"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-base text-white shadow-xs">
              🤖
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight leading-tight">
                알고리즘 첫 수업
              </span>
              <span className="text-[11px] font-normal text-slate-500">
                인간 컴퓨터 활동
              </span>
            </div>
          </Link>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/write"
            className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${
              pathname.startsWith("/write")
                ? "bg-blue-50 text-blue-700 font-semibold shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span className="inline-block mr-1 text-[11px] text-blue-500 font-bold">1단계</span>
            알고리즘 작성
          </Link>

          <Link
            href="/execute"
            className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${
              pathname.startsWith("/execute")
                ? "bg-emerald-50 text-emerald-700 font-semibold shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span className="inline-block mr-1 text-[11px] text-emerald-600 font-bold">2단계</span>
            인간 컴퓨터 실행
          </Link>

          <Link
            href="/teacher"
            className={`rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium transition ${
              pathname.startsWith("/teacher")
                ? "bg-slate-900 text-white font-semibold shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            교사용
          </Link>

          {activeStudent && (
            <div className="ml-2 hidden items-center gap-2 border-l border-slate-200 pl-3 md:flex">
              <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 font-medium">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                <span>{activeStudent}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs text-slate-500 underline hover:text-rose-600 cursor-pointer"
                title="학생 전환 / 로그아웃"
              >
                전환
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
