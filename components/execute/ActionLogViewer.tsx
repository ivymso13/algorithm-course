"use client";

type LogEntry = {
  at: string;
  type: string;
  action?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  reason?: string;
};

interface ActionLogViewerProps {
  log: LogEntry[];
  count: number;
  referenceCount?: number;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

function formatLogAction(entry: LogEntry): { title: string; detail: string; badge: string; color: string } {
  if (entry.type === "unexecutable") {
    return {
      title: "실행 불가 기록",
      detail: entry.reason || "",
      badge: "신고",
      color: "bg-amber-100 text-amber-800 border-amber-300",
    };
  }

  const { action, params, result } = entry;
  const p = params ?? {};
  const r = (result ?? {}) as Record<string, unknown>;

  switch (action) {
    case "placeLeft":
      return {
        title: "왼쪽 저울에 동전 배치",
        detail: `동전 [${((p.coins as number[]) ?? []).join(", ")}]`,
        badge: "준비",
        color: "bg-blue-100 text-blue-800 border-blue-200",
      };
    case "placeRight":
      return {
        title: "오른쪽 저울에 동전 배치",
        detail: `동전 [${((p.coins as number[]) ?? []).join(", ")}]`,
        badge: "준비",
        color: "bg-purple-100 text-purple-800 border-purple-200",
      };
    case "clearPans":
      return {
        title: "저울 접시 비우기",
        detail: "양쪽 접시의 동전을 모두 내림",
        badge: "정리",
        color: "bg-slate-100 text-slate-700 border-slate-200",
      };
    case "weigh": {
      const resStr =
        result === "balanced"
          ? "⚖️ 평형 (무게 같음)"
          : result === "left"
          ? "⬅️ 왼쪽 접시가 무거움"
          : "➡️ 오른쪽 접시가 무거움";
      return {
        title: "저울질 수행",
        detail: `판정 결과: ${resStr}`,
        badge: "측정",
        color: "bg-indigo-100 text-indigo-900 border-indigo-300",
      };
    }
    case "flip": {
      if ("position" in p) {
        return {
          title: `${p.position}번 카드 뒤집기`,
          detail: `확인된 숫자: ${r.value !== undefined ? r.value : "?"}`,
          badge: "확인",
          color: "bg-blue-100 text-blue-800 border-blue-200",
        };
      }
      if ("k" in p) {
        return {
          title: `위에서 ${p.k}장 뒤집기`,
          detail: `새 순서: [${((r.stack as number[]) ?? []).join(", ")}]`,
          badge: "뒤집기",
          color: "bg-amber-100 text-amber-900 border-amber-300",
        };
      }
      return {
        title: "카드/팬케이크 뒤집기",
        detail: JSON.stringify(params),
        badge: "조작",
        color: "bg-slate-100 text-slate-700 border-slate-200",
      };
    }
    case "remove":
      return {
        title: `${p.person}번 사람 제거`,
        detail: `남은 인원: ${r.remaining ?? "?"}명 ${
          r.nextUp ? `(다음 순서: ${r.nextUp}번)` : ""
        }`,
        badge: "제거",
        color: "bg-rose-100 text-rose-800 border-rose-200",
      };
    default:
      return {
        title: action || "행동 수행",
        detail: `${JSON.stringify(params)} ➔ ${JSON.stringify(result)}`,
        badge: "행동",
        color: "bg-slate-100 text-slate-700 border-slate-200",
      };
  }
}

export function ActionLogViewer({ log, count, referenceCount }: ActionLogViewerProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <h4 className="text-xs font-bold text-slate-800">
            실시간 행동 로그
          </h4>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          <span>누적 행동:</span>
          <span className="text-sm font-bold text-blue-600">{count}회</span>
          {referenceCount !== undefined && (
            <span className="text-slate-400 font-normal">
              / 기준 {referenceCount}회
            </span>
          )}
        </div>
      </div>

      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
        {log.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
            아직 수행한 행동이 없습니다. 알고리즘 지시에 따라 버튼을 조작하세요.
          </div>
        ) : (
          log.map((entry, i) => {
            const { title, detail, badge, color } = formatLogAction(entry);
            const timeStr = formatTime(entry.at);

            return (
              <div
                key={i}
                className="flex items-start justify-between rounded-xl bg-slate-50 p-2.5 text-xs border border-slate-100"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 font-mono text-[11px] font-bold text-slate-400">
                    #{i + 1}
                  </span>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{title}</span>
                      <span
                        className={`rounded-md border px-1.5 py-0.2 text-[10px] font-semibold ${color}`}
                      >
                        {badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-mono">{detail}</p>
                  </div>
                </div>
                {timeStr && (
                  <span className="text-[10px] text-slate-400 shrink-0">{timeStr}</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
