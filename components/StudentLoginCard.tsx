"use client";

import { useState } from "react";
import { ROSTER } from "@/lib/assignments";

interface StudentLoginCardProps {
  title: string;
  subtitle: string;
  stepNumber: "1단계" | "2단계";
  onLogin: (studentId: string, name: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function StudentLoginCard({
  title,
  subtitle,
  stepNumber,
  onLogin,
  loading,
  error,
}: StudentLoginCardProps) {
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");

  function handleSelectRoster(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (!val) return;
    const [sId, ...rest] = val.split(" ");
    setStudentId(sId);
    setName(rest.join(" "));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId.trim() || !name.trim()) return;
    await onLogin(studentId.trim(), name.trim());
  }

  const isStep1 = stepNumber === "1단계";

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
              isStep1
                ? "bg-blue-50 text-blue-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {stepNumber}
          </span>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{subtitle}</p>
        </div>

        <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <label
            htmlFor="roster-select"
            className="block text-xs font-semibold text-slate-700"
          >
            📋 명렬표에서 빠른 선택
          </label>
          <select
            id="roster-select"
            value={studentId && name ? `${studentId} ${name}` : ""}
            onChange={handleSelectRoster}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden"
          >
            <option value="">-- 학생을 선택하세요 --</option>
            {ROSTER.map((student) => (
              <option
                key={student.studentId}
                value={`${student.studentId} ${student.name}`}
              >
                {student.studentId} · {student.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative mb-5 flex items-center justify-center">
          <div className="w-full border-t border-slate-200" />
          <span className="absolute bg-white px-3 text-xs text-slate-400">
            또는 직접 입력
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="studentId-input"
              className="block text-xs font-semibold text-slate-700"
            >
              학번
            </label>
            <input
              id="studentId-input"
              type="text"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden"
              placeholder="예: 10101"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="name-input"
              className="block text-xs font-semibold text-slate-700"
            >
              이름
            </label>
            <input
              id="name-input"
              type="text"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden"
              placeholder="예: 학생1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !studentId.trim() || !name.trim()}
            className={`w-full rounded-lg py-2.5 px-4 text-sm font-semibold text-white shadow-xs transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
              isStep1
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                확인 중...
              </span>
            ) : (
              "시작하기 ➔"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
