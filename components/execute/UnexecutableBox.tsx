"use client";

import { useState } from "react";

interface UnexecutableBoxProps {
  unexecutableFlag: boolean;
  unexecutableReason?: string | null;
  onRecord: (reason: string) => Promise<void>;
  loading: boolean;
}

const QUICK_REASONS = [
  "존재하지 않는 명령",
  "종료 조건(언제 끝나는지) 없음",
  "모호해서 임의 해석 불가능",
  "앞뒤 논리 모순",
  "대상의 구체적 번호 누락",
];

export function UnexecutableBox({
  unexecutableFlag,
  unexecutableReason,
  onRecord,
  loading,
}: UnexecutableBoxProps) {
  const [reason, setReason] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("사유를 입력해주세요.");
      return;
    }
    setError(null);
    await onRecord(reason.trim());
    setReason("");
    setIsExpanded(false);
  }

  function handleQuickSelect(tag: string) {
    setReason((prev) => (prev ? `${prev}, ${tag}` : tag));
    setIsExpanded(true);
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <div>
            <h4 className="text-xs font-bold text-amber-900">
              실행 불가 / 명령 부재 신고
            </h4>
            <p className="text-[11px] text-amber-800">
              알고리즘에 없는 행동이거나 그대로 따라 할 수 없는 지점이 있으면 기록하세요.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-100 transition cursor-pointer"
        >
          {isExpanded ? "닫기 ▲" : "신고 작성 ▼"}
        </button>
      </div>

      {unexecutableFlag && (
        <div className="mt-3 rounded-xl bg-amber-100/90 p-3 border border-amber-300 text-xs text-amber-950">
          <span className="font-bold block mb-1">🚨 기록된 실행 불가 사유:</span>
          <p className="whitespace-pre-wrap font-mono text-[11px]">
            {unexecutableReason || "실행 불가 지점이 기록되었습니다."}
          </p>
        </div>
      )}

      {isExpanded && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-amber-200/80 pt-3">
          <div>
            <span className="text-[11px] font-bold text-amber-900 block mb-1.5">
              빠른 사유 태그 선택:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleQuickSelect(tag)}
                  className="rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100 cursor-pointer transition shadow-2xs"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <textarea
              required
              rows={2}
              aria-label="실행 불가 사유"
              className="w-full rounded-lg border border-amber-300 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-hidden"
              placeholder="예: 3단계에서 '확인한다'고만 적혀 있고 크면 어느 쪽으로 갈지 분기가 적혀 있지 않음"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-amber-100 cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? "기록 중..." : "실행 불가 기록 제출"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
