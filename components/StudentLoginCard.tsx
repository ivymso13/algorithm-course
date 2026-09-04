"use client";

import { useRef, useState } from "react";

interface StudentLoginCardProps {
  title: string;
  subtitle: string;
  /** A short badge label, e.g. "1단계" for a numbered flow step, or a plain
   * label like "체험" for a page that isn't part of the numbered flow. */
  stepNumber: string;
  onLogin: (school: string, studentId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const SCHOOL_REGEX = /^[A-Za-zㄱ-ㆎ가-힣0-9·\s-]{1,40}$/;
const STUDENT_ID_REGEX = /^[A-Za-z0-9]{1,20}$/;

export function StudentLoginCard({
  title,
  subtitle,
  stepNumber,
  onLogin,
  loading,
  error,
}: StudentLoginCardProps) {
  const [school, setSchool] = useState("");
  const [studentId, setStudentId] = useState("");
  const [consent, setConsent] = useState(false);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    school?: string;
    studentId?: string;
    consent?: string;
  }>({});

  // Touched state for blur validation
  const [touched, setTouched] = useState<{
    school?: boolean;
    studentId?: boolean;
    consent?: boolean;
  }>({});

  const schoolInputRef = useRef<HTMLInputElement>(null);
  const studentIdInputRef = useRef<HTMLInputElement>(null);
  const consentInputRef = useRef<HTMLInputElement>(null);

  function validateField(field: "school" | "studentId" | "consent", value: unknown): string | undefined {
    if (field === "school") {
      const val = typeof value === "string" ? value.trim() : "";
      if (!val) return "학교를 입력해주세요.";
      if (!SCHOOL_REGEX.test(val)) {
        return "학교는 1~40자 한글, 영문 또는 숫자만 사용할 수 있습니다.";
      }
    } else if (field === "studentId") {
      const val = typeof value === "string" ? value.trim() : "";
      if (!val) return "학번을 입력해주세요.";
      if (!STUDENT_ID_REGEX.test(val)) {
        return "학번은 1~20자 영문 또는 숫자만 사용할 수 있습니다.";
      }
    } else if (field === "consent") {
      if (value !== true) {
        return "개인정보 수집·이용에 동의하셔야 수업 활동에 참여할 수 있습니다.";
      }
    }
    return undefined;
  }

  function handleBlur(field: "school" | "studentId") {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const val = field === "school" ? school : studentId;
    const errorMsg = validateField(field, val);
    setFieldErrors((prev) => ({ ...prev, [field]: errorMsg }));
  }

  function handleSchoolChange(val: string) {
    setSchool(val);
    if (touched.school) {
      setFieldErrors((prev) => ({ ...prev, school: validateField("school", val) }));
    }
  }

  function handleStudentIdChange(val: string) {
    setStudentId(val);
    if (touched.studentId) {
      setFieldErrors((prev) => ({ ...prev, studentId: validateField("studentId", val) }));
    }
  }

  function handleConsentChange(checked: boolean) {
    setConsent(checked);
    if (touched.consent) {
      setFieldErrors((prev) => ({ ...prev, consent: validateField("consent", checked) }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const schoolErr = validateField("school", school);
    const sIdErr = validateField("studentId", studentId);
    const consentErr = validateField("consent", consent);

    const newErrors = {
      school: schoolErr,
      studentId: sIdErr,
      consent: consentErr,
    };

    setTouched({
      school: true,
      studentId: true,
      consent: true,
    });
    setFieldErrors(newErrors);

    // Focus the first invalid input for keyboard and screen reader accessibility
    if (schoolErr) {
      schoolInputRef.current?.focus();
      return;
    }
    if (sIdErr) {
      studentIdInputRef.current?.focus();
      return;
    }
    if (consentErr) {
      consentInputRef.current?.focus();
      return;
    }

    await onLogin(school.trim(), studentId.trim());
  }

  const isStep1 = stepNumber === "1단계";

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        {/* Header Badge & Title */}
        <div className="mb-6 text-center">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
              isStep1
                ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
            }`}
          >
            {stepNumber}
          </span>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
            {subtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Server / API Error Banner with Actionable Advice */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-xl border border-rose-200 bg-rose-50/95 p-3.5 text-xs text-rose-900 shadow-xs space-y-1.5"
            >
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <span className="text-base" aria-hidden="true">⚠️</span>
                <span>입력 정보를 다시 확인해주세요</span>
              </div>
              <p className="leading-relaxed pl-6 font-medium">{error}</p>
              {error.includes("학교와 학번") && (
                <p className="text-[11px] text-rose-700 pl-6">
                  👉 출석부 명단에 등록된 학교와 학번인지 확인하고, 오타나 띄어쓰기를 점검하세요.
                </p>
              )}
              {error.includes("만료") && (
                <p className="text-[11px] text-rose-700 pl-6">
                  👉 접속 세션이 만료되었습니다. 학교와 학번으로 다시 로그인하면 작업 내용이 복구됩니다.
                </p>
              )}
            </div>
          )}

          {/* School & Student ID Fields (Responsive 1-col on mobile, 2-col on sm+) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="student-school" className="text-xs font-semibold text-slate-700">
                  학교 <span className="text-rose-500" aria-hidden="true">*</span>
                </label>
                <span id="student-school-hint" className="text-[11px] text-slate-400">
                  예: OO고
                </span>
              </div>
              <input
                ref={schoolInputRef}
                id="student-school"
                type="text"
                required
                autoComplete="organization"
                autoCorrect="off"
                spellCheck={false}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.school)}
                aria-describedby={
                  fieldErrors.school
                    ? "student-school-error student-school-hint"
                    : "student-school-hint"
                }
                className={`w-full min-h-[44px] rounded-lg border bg-white px-3 py-2.5 text-base sm:text-sm text-slate-900 shadow-2xs transition focus:ring-2 focus:outline-hidden ${
                  fieldErrors.school
                    ? "border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-rose-200"
                    : "border-slate-300 focus:border-blue-500 focus:ring-blue-200"
                }`}
                placeholder="예: OO고"
                value={school}
                onChange={(e) => handleSchoolChange(e.target.value)}
                onBlur={() => handleBlur("school")}
              />
              {fieldErrors.school && (
                <p
                  id="student-school-error"
                  role="alert"
                  className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1"
                >
                  <span aria-hidden="true">⚠️</span>
                  <span>{fieldErrors.school}</span>
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="student-id" className="text-xs font-semibold text-slate-700">
                  학번 <span className="text-rose-500" aria-hidden="true">*</span>
                </label>
                <span id="student-id-hint" className="text-[11px] text-slate-400">
                  예: 10101
                </span>
              </div>
              <input
                ref={studentIdInputRef}
                id="student-id"
                type="text"
                required
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.studentId)}
                aria-describedby={
                  fieldErrors.studentId
                    ? "student-id-error student-id-hint"
                    : "student-id-hint"
                }
                className={`w-full min-h-[44px] rounded-lg border bg-white px-3 py-2.5 text-base sm:text-sm text-slate-900 shadow-2xs transition focus:ring-2 focus:outline-hidden ${
                  fieldErrors.studentId
                    ? "border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-rose-200"
                    : "border-slate-300 focus:border-blue-500 focus:ring-blue-200"
                }`}
                placeholder="예: 10101"
                value={studentId}
                onChange={(e) => handleStudentIdChange(e.target.value)}
                onBlur={() => handleBlur("studentId")}
              />
              {fieldErrors.studentId && (
                <p
                  id="student-id-error"
                  role="alert"
                  className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1"
                >
                  <span aria-hidden="true">⚠️</span>
                  <span>{fieldErrors.studentId}</span>
                </p>
              )}
            </div>
          </div>

          {/* Privacy Notice & Consent Section */}
          <section
            aria-labelledby="privacy-notice-heading"
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-600 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-200 pb-2">
              <h2 id="privacy-notice-heading" className="font-bold text-slate-800 flex items-center gap-1.5">
                <span aria-hidden="true">📄</span>
                <span>개인정보 수집 및 이용 안내 (필수)</span>
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100/70 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                <span aria-hidden="true">🔒</span>
                <span>2단계 상호 실행 시 익명 보장</span>
              </span>
            </div>

            <ul id="privacy-notice-details" className="space-y-1 text-[11px] leading-relaxed text-slate-600 list-none p-0 m-0">
              <li className="flex items-start gap-1.5">
                <strong className="text-slate-800 shrink-0">· 수집 항목:</strong>
                <span>학교, 학번, 이름(사전 등록된 명단 정보), 작성 알고리즘, 실행 기록 및 동료 평가 응답</span>
              </li>
              <li className="flex items-start gap-1.5">
                <strong className="text-slate-800 shrink-0">· 수집 목적:</strong>
                <span>수업 활동 운영(알고리즘 작성·상호 실행·평가 및 피드백), 학습 이력 관리 및 교사 지도</span>
              </li>
              <li className="flex items-start gap-1.5">
                <strong className="text-slate-800 shrink-0">· 보관 기간:</strong>
                <span>수업 종료 및 평가 완료 시까지 (최대 90일 보관 후 영구 파기, 교사 요청 시 즉시 파기)</span>
              </li>
              <li className="flex items-start gap-1.5">
                <strong className="text-slate-800 shrink-0">· 익명 원칙:</strong>
                <span>2단계 동료 실행 시 작성자의 학번과 이름은 다른 학생에게 노출되지 않으며 문제와 알고리즘만 전달됩니다.</span>
              </li>
              <li className="flex items-start gap-1.5 text-slate-500">
                <strong className="text-slate-700 shrink-0">· 동의 거부:</strong>
                <span>동의를 거부할 권리가 있으며, 거부 시 본 수업 활동(알고리즘 작성 및 실행) 참여가 제한됩니다.</span>
              </li>
            </ul>

            <div
              className={`rounded-lg border p-2.5 transition-colors ${
                fieldErrors.consent
                  ? "border-rose-300 bg-rose-50/70"
                  : consent
                  ? "border-blue-200 bg-blue-50/40"
                  : "border-slate-200 bg-white hover:bg-slate-50/80"
              }`}
            >
              <label
                htmlFor="privacy-consent"
                className="flex items-start gap-2.5 cursor-pointer select-none"
              >
                <input
                  ref={consentInputRef}
                  id="privacy-consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => handleConsentChange(e.target.checked)}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.consent)}
                  aria-describedby={
                    fieldErrors.consent
                      ? "privacy-consent-error privacy-notice-details"
                      : "privacy-notice-details"
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 leading-snug">
                  [필수] 위 개인정보 수집·이용 목적, 보유 기간 및 익명 처리 방침을 확인하였으며 이에 동의합니다.
                </span>
              </label>

              {fieldErrors.consent && (
                <p
                  id="privacy-consent-error"
                  role="alert"
                  className="mt-1.5 text-[11px] font-semibold text-rose-600 pl-6 flex items-center gap-1"
                >
                  <span aria-hidden="true">⚠️</span>
                  <span>{fieldErrors.consent}</span>
                </p>
              )}
            </div>
          </section>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className={`w-full min-h-[44px] rounded-xl py-3 px-4 text-sm font-bold text-white shadow-xs transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-2 ${
              isStep1
                ? "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-600"
                : "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-600"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden="true"
                />
                <span>로그인 확인 중...</span>
              </span>
            ) : (
              <span>{stepNumber} 시작하기 ➔</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
