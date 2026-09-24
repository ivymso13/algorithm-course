# 알고리즘 첫 수업 — 인간 컴퓨터 체험 웹앱

`references/알고리즘 체험 사이트.md`(프로젝트 루트) 스펙을 구현한 vinext(Next.js App
Router 스타일 + Cloudflare Workers) 사이트입니다. Cloudflare D1(SQLite 호환)에
수업, 학생 로그인/세션, 알고리즘 제출, 실행 로그, 채점, 평가, 2단계 활성화 상태를
저장합니다.

이 문서는 **Antigravity가 이어서 UI를 다듬을 때** 필요한 구조와 사용법 요약입니다.
로직/스키마/API는 기능적으로 완성되어 있고, 페이지는 의도적으로 최소 스타일(기본
Tailwind 유틸리티)만 적용된 골격 상태입니다.

## 현재 기본 활동 — 워밍업 라운드

`/write`, `/execute`는 이제 고정 4문제 배정이 아니라 **교사가 진행하는 단일
워밍업 라운드**를 사용합니다: 교사가 문제 하나를 만들어 공개 → 전원이 알고리즘을
제출 → 제출 후 익명 보드에서 서로의 알고리즘에 4가지 유형으로 투표(중복 방지) →
보드에서 고른 알고리즘을 범용 단계 체크리스트로 따라가며 실행 가능 여부+짧은
피드백 제출 → 교사가 라운드를 종료. `lib/warmupStore.ts` / `db/schema.ts`의
`warmup_*` 테이블 / `app/api/warmup/**`, `app/api/teacher/warmup/**`가 이 흐름을
담당합니다. 기존 4문제(12coins/card/josephus/pancake) 시뮬레이터·배정 로직
(`lib/problems/*`, `lib/assignments.ts`, `submissions`/`attempts` 테이블,
`app/api/write/*`·`app/api/execute/*`의 기존 라우트)은 삭제하지 않고 그대로
남겨두었습니다 — 교사용 대시보드의 "(이전 방식)" 탭과 "문제별 함께 풀어보기"
탭에서 계속 쓸 수 있는 선택형 체험 템플릿입니다.

## 공개 배포 보안 모델 (중요)

이 사이트는 ChatGPT/GitHub 계정 로그인 없이 **누구나 URL만 알면 접근 가능한 공개
배포**를 전제로 합니다. 그래서 다음을 반드시 지켜서 구현되어 있습니다.

- **수업 코드 게이트**: 학생은 `수업 코드 + 학번 + 이름`을 입력해야만 시작할 수
  있습니다. 수업 코드는 `courses` 테이블에 저장되고 교사 대시보드(`/teacher`)
  상단에 표시되며, 언제든 재발급할 수 있습니다(§교사 비밀번호 참고). 학번+이름은
  여전히 `lib/assignments.ts`의 하드코딩된 배정 명단(ROSTER)에 있어야만 통과됩니다
  — 수업 코드는 "누가 접근을 시도할 수 있는가"를, 명단은 "그 사람이 실제 배정된
  학생인가"를 검증하는 이중 게이트입니다.
- **불투명 세션 쿠키**: 로그인에 성공하면 서버가 256비트 난수 토큰을 발급해
  `HttpOnly; Secure; SameSite=Lax` 쿠키로 내려줍니다. DB(`sessions` 테이블)에는
  토큰의 SHA-256 해시만 저장되므로, DB가 유출되어도 세션을 재사용할 수 없습니다.
  이후 모든 학생용 API(`/api/write/*`, `/api/execute/*`)는 요청 바디의
  `studentKey`를 신뢰하지 않고 이 쿠키로만 신원을 판별합니다.
- **IDOR 차단**: `attemptId`는 단순 증가하는 정수라서 추측이 가능합니다. 서버는
  모든 실행(execute) 관련 API에서 "이 attempt의 `executorKey`가 현재 세션의
  studentKey와 일치하는가"를 확인한 뒤에만 조회/조작을 허용합니다
  (`lib/store.ts`의 `getOwnedAttempt`, `OwnershipError` 참고). 평가 결과 조회
  (`GET /api/execute/evaluate`)도 과거에는 인증이 전혀 없었는데 동일하게 막았습니다.
- **교사 비밀번호 안전 실패**: `TEACHER_PASSWORD` 환경변수가 비어 있으면 어떤
  값을 보내도 교사 API가 절대 통과되지 않습니다(과거처럼 `teacher123` 기본값으로
  통과되는 일이 없습니다). 자세한 내용은 §교사 비밀번호 참고.
- **입력 검증**: 수업 코드/학번/이름/알고리즘 본문/실행-불가 사유 등 클라이언트가
  보내는 모든 문자열은 `lib/validation.ts`에서 길이·형식을 서버에서 다시
  검증합니다(클라이언트 검증은 UX용일 뿐 신뢰하지 않습니다).
- **개인정보 처리 안내**: 로그인 화면에 수집 항목·목적·보관 기간을 안내하고
  명시적 동의 체크박스를 통과해야만 세션이 생성됩니다. 동의 시각(`consentAt`)과
  보관 기한(`courses.retentionDays`, 기본 90일)이 DB에 함께 저장됩니다.

## 빠른 시작

```bash
npm install      # (init 스크립트가 이미 실행함)
npm run dev      # http://localhost:3000 (또는 --port로 지정)
npm run build    # vinext 프로덕션 빌드 검증
npm test         # build + 렌더링 테스트 + 순수 로직 유닛 테스트
npm run test:unit  # 유닛 테스트만 (build 없이 빠르게)
```

로컬 개발 시 D1 테이블은 **첫 요청 시 자동 생성**됩니다 (`db/index.ts`의
`ensureSchema` — `CREATE TABLE IF NOT EXISTS` 배치를 idempotent하게 실행).
스키마를 바꾸면 `npm run db:generate`로 Drizzle 마이그레이션을 재생성하고
`db/index.ts`의 `SCHEMA_STATEMENTS`도 함께 갱신하세요 (실제 배포 시에는 Sites
플랫폼이 `drizzle/*.sql`을 D1에 적용합니다 — `db/index.ts`의 부트스트랩은 로컬
개발 편의용 보강 장치입니다).

로컬에서 로그인을 시험해보려면 `/teacher`에 먼저 들어가서(`TEACHER_PASSWORD` 필요)
자동 발급된 수업 코드를 확인하세요 — `COURSE_CODE` 환경변수로 원하는 코드를 직접
지정할 수도 있습니다 (`.env.example` 참고).

## 페이지 & 라우트

| 경로 | 설명 |
|---|---|
| `/` | 랜딩 페이지 (3개 화면으로 링크) |
| `/write` | 1단계 — 수업 코드+학번+이름 로그인(+개인정보 동의) → 배정된 2문제 알고리즘 작성/제출. 이미 실행된 본인 제출물이 있으면 "실행 결과 리뷰 카드"를 먼저 보여줌. 제출 완료 후에는 수정/재제출 가능 |
| `/execute` | 2단계 — 수업 코드+학번+이름 로그인 → (교사가 2단계를 열기 전이면 대기 안내) 배정된 2문제를 순서대로 실행 → 최종 답 제출 → 같은 화면에서 결과/평가로 전환 → 다음 라운드 |
| `/teacher` | 교사 관리 화면 — 비밀번호 입력 후 수업 코드 확인/재발급 / 제출 현황 대시보드 / 2단계 활성화 / 결과 리뷰(문제 유형별) / 엑셀 내보내기 / 발표 모드 연습 화면 |

## 핵심 구조

```
lib/assignments.ts     학번+이름 → {write:[2], execute:[2]} 하드코딩 배정 (§1, 변경 없음)
                        ROSTER 배열만 실제 학급 명단으로 교체하면 6개 조합에
                        2명씩 자동 배치됨 (인원수가 달라져도 동일 원리로 재배치)
                        — 이 배정 로직 자체는 이번 변경에서 건드리지 않았습니다.
lib/session.ts          세션 토큰/쿠키 순수 함수 (생성·해시·직렬화, DB 미의존 — 유닛 테스트 가능)
lib/validation.ts       수업코드/학번/이름/알고리즘/사유 등 서버측 입력 검증
lib/requireStudentSession.ts  라우트에서 쿠키 → 세션 조회 (IDOR 방지의 진입점)
lib/http.ts             Set-Cookie 헤더를 붙인 JSON 응답 헬퍼
lib/problems/           문제 4종 로직 (랜덤 입력 생성 + 허용 행동 + 채점)
  types.ts              공통 인터페이스 (ProblemModule)
  coins.ts / cards.ts / josephus.ts / pancake.ts
  index.ts              레지스트리 (generateInstance, applyProblemAction, publicInputFor)
lib/store.ts            DB 접근 계층 (수업/학생/세션 CRUD, 제출/시도 CRUD + 소유권 검사,
                         배정 로직 조회, 채점, 교사 조회)
lib/teacherAuth.ts       교사 비밀번호 검사 (헤더 `x-teacher-password`, 미설정 시 안전 실패)
lib/xlsxExport.ts        SheetJS로 4개 시트 엑셀 생성 (제출/실행기록/학생배정/단계상태)
lib/problemMeta.ts       문제 설명/라벨/작성 안내 문구 (한국어, UI에서 사용)
db/schema.ts             Drizzle 스키마 (courses / students / sessions / submissions / attempts)
db/index.ts              getDb() — D1 바인딩 + 로컬 스키마 부트스트랩
app/api/**               아래 "API 요약" 참고
app/write, app/execute,
app/teacher               페이지 (클라이언트 컴포넌트, 최소 스타일)
tests/problems.test.ts    문제별 채점/제약 유닛 테스트 (tsx --test)
tests/assignments.test.ts 배정 로직이 스펙 예시 표와 일치하는지 검증
tests/session.test.ts     세션 토큰/쿠키 순수 함수 유닛 테스트
tests/validation.test.ts  입력 검증 유닛 테스트
tests/teacherAuth.test.ts 교사 비밀번호 안전 실패(no default) 유닛 테스트
tests/rendered-html.test.mjs  빌드 산출물이 랜딩 페이지를 정상 렌더링하는지 검증
```

## 교사 비밀번호

`/teacher`의 모든 API는 요청 헤더 `x-teacher-password`를 확인합니다. 환경변수
`TEACHER_PASSWORD`를 **반드시** 설정해야 하며, 기본값은 없습니다 — 비어 있으면
어떤 비밀번호를 보내도 항상 401/503으로 거부됩니다(안전 실패, `.env.example`
참고). Sites 배포 시에는 실제 값을 호스팅 플랫폼의 런타임 환경 변수로 설정하세요.

## 수업 코드 & 학급 명단

- **수업 코드**: `/teacher`에 처음 로그인하면 서버가 자동으로 수업(course) 레코드를
  만들고 임의의 8자리 코드를 발급합니다 (`COURSE_CODE` 환경변수로 원하는 값을 직접
  지정할 수도 있습니다). 대시보드 상단에서 코드를 확인·재발급할 수 있고, 이 코드를
  학생들에게 공유하면 됩니다. 재발급해도 이미 로그인한 학생의 세션은 유지됩니다.
- **학급 명단**: `lib/assignments.ts`의 `ROSTER` 배열을 실제 학번/이름으로
  교체하세요. 6가지 조합(AB↔CD, AC↔BD, AD↔BC)에 2명씩 순서대로 배정되며, 인원이
  6의 배수가 아니어도 자동으로 고르게 분배됩니다(`buildAssignments`).
  `tests/assignments.test.ts`가 스펙 §1의 12명 예시 표와 정확히 일치하는지
  확인합니다. 수업 코드를 통과해도 이 명단에 없는 학번+이름은 로그인할 수 없습니다.

## API 요약

모두 `app/api/**/route.ts`. 학생용 API는 `POST /api/student/login`이 발급한
**세션 쿠키**(`algo_session`, HttpOnly/Secure/SameSite=Lax)로 신원을 식별합니다
— 요청 바디의 studentKey는 더 이상 신뢰되지 않습니다. 교사용 API는
`x-teacher-password` 헤더가 필요합니다.

- `POST /api/student/login` — 수업 코드+학번+이름+동의 → 세션 쿠키 발급 + 배정 + 1단계 진행 상황
- `POST /api/student/logout` — 세션 무효화 + 쿠키 삭제
- `GET /api/student/me` — 세션 쿠키로 현재 로그인한 학생 확인 (배정 정보만, write 스냅샷 없이)
- `GET /api/write/next` / `POST /api/write/submit` — 1단계 조회/제출(업서트), 세션 기반
- `GET /api/stage` — 2단계 활성화 여부 (기본 수업 기준)
- `POST /api/execute/assign` — 다음 실행 대상 배정 (waiting/finished/noneAvailable/ready), 세션 기반
- `POST /api/execute/action` — 문제별 허용 행동 실행 (좌/우 저울 올리기, 저울질,
  카드 뒤집기, 사람 제거, 팬케이크 뒤집기 등 — `lib/problems/*.ts`의 `actions` 참고).
  attemptId 소유권을 세션과 대조해 IDOR을 차단합니다.
- `POST /api/execute/unexecutable` — "실행 불가" 사유 기록 (진행 막지 않음), 소유권 검사 포함
- `POST /api/execute/submit-answer` — 최종 숫자 제출 → 채점 결과 반환, 소유권 검사 포함
- `POST /api/execute/evaluate` / `GET /api/execute/evaluate` — 평가 문항 제출/조회,
  소유권 검사 포함(과거 GET은 인증이 전혀 없었음)
- `POST /api/teacher/stage2` — 2단계 활성화
- `GET /api/teacher/dashboard` / `GET /api/teacher/review` — 대시보드 / 결과 리뷰
- `GET /api/teacher/export` — xlsx 다운로드
- `GET /api/teacher/course` / `POST /api/teacher/course` — 수업 코드 조회 / 재발급

## 문제 유형별 채점 요약 (`lib/problems/`)

- **12coins**: 가짜 동전 번호(1~12) + 무겁다/가벼움(숨김)을 랜덤 생성. 저울질마다
  왼쪽/오른쪽 동전을 올리고 `weigh`로 결과(left/right/balanced) 확인. 같은 동전을
  양쪽에 동시에 올릴 수 없음.
- **card**: 오름차순 배열(12~18장) + 목표 숫자(20% 확률로 배열에 없음). 정답은
  위치(1-base) 또는 없으면 0.
- **josephus**: N(8~12), k(2~4) 랜덤. 실행자가 직접 제거할 사람을 선택하면(웹은
  다음 차례 사람만 알려줌, 몇 번째로 세는지는 실행자 몫) 서버가 별도로 표준
  조세퍼스 시뮬레이션으로 정답을 계산해 채점.
- **pancake**: N(4~6, 이미 정렬된 상태로는 생성되지 않음). 정답은 항상 오름차순
  인코딩(`1234`형태, N≤9라 자리수 겹침 없음).

## UI 다듬을 때 참고

- 4개 페이지 모두 `"use client"` 컴포넌트이며 Tailwind 유틸리티 클래스만 사용 —
  디자인 시스템/컴포넌트 라이브러리 없이 최소 골격만 있습니다.
- `app/execute/page.tsx`는 문제 유형별 컨트롤(`CoinsControls`, `CardControls`,
  `JosephusControls`, `PancakeControls`)이 한 파일에 있습니다. 다듬을 때 별도
  컴포넌트 파일로 분리해도 좋습니다.
- 실행 화면은 스펙 §2.2대로 상단에 알고리즘 원문(스크롤 가능), 하단에 허용 행동
  버튼, "실행 불가" 버튼, 실시간 행동 로그를 항상 보여줍니다.
- 결과/평가는 페이지 이동 없이 같은 `/execute` 화면 안에서 상태 전환됩니다(§2.3).

## 알려진 제약 / TODO

- 학생 신원 확인은 수업 코드 + 학번+이름 문자열 일치 + 세션 쿠키입니다(교실 활동용
  경량 설계, ChatGPT/GitHub 계정 로그인 없음 — 스펙 의도와 일치).
- 개인정보 보관 기한(`courses.retentionDays`, 기본 90일)은 메타데이터로 저장될 뿐,
  기한 도래 시 자동 삭제 배치는 아직 없습니다. 학기 종료 후 `students` /
  `submissions` / `attempts` / `sessions` 로우를 수동으로(또는 별도 크론으로)
  삭제하세요.
- 팬케이크 최종 답은 실행자가 "자신이 읽은" 최종 순서를 스스로 인코딩해 제출하는
  방식입니다(스펙 §3-4 그대로) — 서버가 자동으로 채워주지 않습니다.
- `/execute`의 "대기 중" / "알고리즘 없음" 화면은 수동 새로고침 버튼입니다(자동
  폴링 없음) — 필요하면 UI 다듬는 단계에서 주기적 폴링을 추가할 수 있습니다.

## 저장소 구조 참고 (중요)

이 프로젝트 루트(`algorithm-course/`)는 이미 git 저장소이고, `references/`
폴더가 있어 Sites init 스크립트를 루트에 바로 실행할 수 없었습니다(스크립트는
빈 디렉터리에서만 실행됨). 그래서 실제 사이트 코드는 `site/` 하위 디렉터리에
초기화했고, init 스크립트가 `site/` 안에 **별도의 git 저장소**를 새로 만들었습니다
(아직 커밋 없음). 즉 이 저장소는 중첩된 두 개의 git 저장소를 갖고 있습니다 — 필요에
따라 `site/`를 별도 저장소로 유지하거나, 루트 저장소에 통합(예: `site/.git` 제거 후
루트에서 커밋)하는 방식을 선택하면 됩니다.

## Cloudflare 배포 메모 (starter 원본 내용)

- `.openai/hosting.json`이 D1 바인딩(`DB`)을 선언합니다. Sites 플랫폼이 실제
  Cloudflare 리소스와 배포를 관리합니다.
- `vite.config.ts`가 로컬 개발용으로 선언된 바인딩을 시뮬레이션합니다.
- `wrangler.jsonc`는 직접 사용하지 않습니다 — `npm run build`가 `dist/server/wrangler.json`을
  자동 생성하고, Sites 플랫폼이 이를 바탕으로 실제 Cloudflare 리소스에 배포하며
  `dist/.openai/drizzle/*.sql` 마이그레이션을 D1에 적용합니다.
- starter에 포함되어 있던 `app/chatgpt-auth.ts`(ChatGPT 계정 로그인용 헬퍼)는
  이 배포에서 어디서도 사용되지 않아 제거했습니다 — 이 사이트는 ChatGPT/GitHub
  로그인 없이 수업 코드만으로 접근하는 것이 의도된 동작입니다.

## GitHub 저장소 연동 / CI

`.github/workflows/ci.yml`이 `push`/`pull_request`(대상: `main`)마다
`npm ci && npm test && npm run lint`(빌드 + 렌더링 테스트 + 전체 유닛 테스트 +
eslint)를 실행합니다. 실제 배포는 이 저장소를 연결한 Sites/Cloudflare 호스팅
플랫폼이 자체 GitHub 연동으로 `main` 푸시를 감지해 처리합니다(§Cloudflare 배포
메모) — 이 CI 워크플로우는 그 자동 배포 이전에 빌드/테스트가 깨진 커밋이 `main`에
들어가지 않도록 막는 필수 상태 검사(required status check)로 GitHub 브랜치
보호 규칙에 등록해서 사용하세요.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build + rendered-page test + problem/assignment unit tests
- `npm run test:unit`: unit tests only (no build)
- `npm run db:generate`: generate Drizzle migrations after schema changes
- `npm run lint`: eslint

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

## JEV 실행 (상자 문제)

학생이 상자 문제 알고리즘을 제출하면 그 제출 버전에 대한 **자동 AI 실행(무작위 배치 10회)**이 제출 저장과 같은 D1 트랜잭션으로 등록됩니다. 교사는 종료된 라운드에서 별도 AI 실행 작업도 시작할 수 있습니다. 학생은 자기 최신 제출 버전의 결과만 조회하며, 직접 실행 API는 교사 인증이 필요합니다. 결과는 학습 피드백이며 성적을 자동 변경하지 않습니다.

### 제출 즉시 자동 실행 (`lib/jevAuto.ts`, `lib/jevRunner.ts`)

- Sites 호스팅은 D1/R2만 제공하고 Queue·Cron·Durable Object가 없습니다. 그래서 작업은 D1에 영구 저장하고, **열려 있는 학생 화면(`/write/explore`)과 교사 대시보드가 요청마다 한 묶음씩 실행**합니다. 모든 화면이 닫히면 멈추고, 다시 열면 저장된 위치부터 이어갑니다. `waitUntil` 같은 응답 후 백그라운드 실행에 의존하지 않습니다.
- `jev_auto_runs`는 (제출, 버전)당 하나입니다. 같은 내용을 다시 제출하면 버전이 오르지 않아 기존 실행을 그대로 씁니다(과금 없음, 실패 상태였다면 남은 회차만 다시 대기). 내용을 바꾸면 버전이 오르고 이전 실행은 `superseded`가 됩니다. 회차는 `jev_auto_trials`에 (실행, 회차 번호) 고유 행으로 저장되어 병렬 저장에서도 결과가 유실되지 않습니다.
- `jev_trial_slots`의 5개 행이 **전체 서버 공통 동시 실행 한도**입니다(학생·교사 작업 모두). 요청 하나는 빈 슬롯만큼 최대 5회를 병렬 실행하므로 10회는 두 묶음이면 끝납니다.
- 회차 제한 시간은 100초, 슬롯·회차 임대는 130초(제한 시간 + 외부 요청 8초 + 여유)입니다. JEV 외부 요청(`NONE_OF_THESE` 후속 질문 포함) 직전마다 제한 시간, 임대 토큰, 실행 상태, 제출 최신 버전을 D1에서 확인하므로 취소·새 버전·임대 만료된 회차는 다음 요청을 보내지 않고 결과도 저장하지 못합니다. 취소나 새 버전 제출은 슬롯을 즉시 풀지 않고, 실행 중인 요청이 멈춘 뒤 또는 임대 만료 후에만 풀립니다.
- API 장애·시간 초과는 오답이 아닙니다. 해당 회차만 대기로 되돌리고 5초부터 최대 60초까지 늘어나는 대기 후 다시 시도하며, 성공한 회차는 따로 저장됩니다. 연속 4묶음이 실패하면 `failed`로 멈추고 학생의 "남은 실행 다시 시도" 또는 교사의 "남은 실행 이어서 하기"로 재개합니다. 교사는 라운드별로 자동 실행을 중단할 수 있습니다.
- 교사 작업은 같은 제출·버전·모드의 자동 결과를 재사용합니다. 완료된 자동 결과는 추가 호출 없이 가져오고, 진행 중이면 교사 요청이 그 자동 실행을 대신 진행한 뒤 가져옵니다. 교사가 10회보다 많이 요청하면 나머지만 새로 실행합니다.
- 상자 문제가 아닌 라운드의 제출은 기존 방식 그대로 저장되며 자동 실행이 없습니다.

- 운영 환경의 `TYPESAFE_API_KEY`는 Sites 비밀값으로 등록합니다. 키가 없으면 실행을 중단합니다. `USE_JEV_MOCK=true`는 개발 환경에서만 허용되며 운영 빌드에서는 거부됩니다. 모의 결과와 과거 출처 불명 결과는 학생에게 공개하지 않습니다.
- 라운드별 작업은 D1에 저장됩니다. 시작 시 학생 제출 원문과 버전을 고정하고, 요청마다 현재 학생의 남은 회차를 빈 전역 슬롯만큼(최대 5회) 병렬 실행해 저장합니다. 기본 학생당 10회, 최대 50회입니다.
- 교사 화면을 열어두면 다음 실행 요청을 자동으로 보냅니다. **화면을 닫은 동안 계속 돌아가는 상시 작업은 아닙니다.** 다시 열면 저장한 위치부터 이어갑니다. 중단·재시도 시 완료한 실행은 보존됩니다. 끊어진 요청의 잠금은 130초 후 만료되며, 취소 후 재개하면 이전 요청의 결과는 저장되지 않습니다.
- API 장애는 학생의 오답으로 집계하지 않고 작업을 일시 중단합니다. 재시도는 미완료 실행만 처리합니다. 지원 한도(40단계, 단계당 1,000자, 전체 10,000자)를 넘는 제출은 건너뛰고 나머지를 진행합니다.
- 문장 해석은 JEV, 상태 변화와 정답 판정은 코드가 담당합니다. 무한 반복, 현재 상태에서 불가능한 행동, 정답 출력 누락은 실행 실패입니다. 현재 반복은 `확인하지 않은 상자가 있으면 3단계부터 반복한다`와 같은 앞으로 이동하는 순회만 지원합니다. 임의 횟수·중첩 반복은 지원하지 않습니다. 한 단계에 행동을 이어 쓴 문장(`상자를 확인하고 메모지에 기록한다`, `~한 뒤`, `그리고`)은 행동별로 나눠 같은 단계 번호로 차례로 실행합니다. 반복 단계는 나누지 않습니다.
- 한 실행당 최대 60번의 문장 판단, 외부 요청당 8초 제한을 적용합니다. 외부 서비스 오류를 학생 알고리즘의 오류로 바꾸지 않습니다.
- 학생 결과에는 실제 채점한 제출 원문·버전, 정답/오답/실행 실패 횟수, 대표 반례와 실패 단계가 표시됩니다. 라운드·제출 삭제 시 해당 작업과 결과도 제거됩니다.

검증: `npm run typecheck`, `npm run lint`, `npm test`. `tests/jev-flow.test.mjs`(교사 작업)와 `tests/jev-auto-flow.test.mjs`(제출 즉시 자동 실행)는 빌드된 Worker와 D1을 Miniflare에서 실행하고 외부 JEV 응답을 로컬 가짜 서비스로 대체합니다. 실제 API 키나 유료 호출 없이 권한, 설정, 중복 요청, 중단·재시도, 결과 격리와 삭제, 동시 학생 실행의 전역 5회 한도, 새 버전 제출 후 늦게 도착한 결과 차단, 임대 만료 인계, 부분 실패 보존과 재시도, 교사 작업의 자동 결과 재사용을 검사합니다.
