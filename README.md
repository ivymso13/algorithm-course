# 알고리즘 첫 수업 — 인간 컴퓨터 체험 웹앱

`references/알고리즘 체험 사이트.md`(프로젝트 루트) 스펙을 구현한 vinext(Next.js App
Router 스타일 + Cloudflare Workers) 사이트입니다. Cloudflare D1(SQLite 호환)에
학생 배정, 알고리즘 제출, 실행 로그, 채점, 평가, 2단계 활성화 상태를 저장합니다.

이 문서는 **Antigravity가 이어서 UI를 다듬을 때** 필요한 구조와 사용법 요약입니다.
로직/스키마/API는 기능적으로 완성되어 있고, 페이지는 의도적으로 최소 스타일(기본
Tailwind 유틸리티)만 적용된 골격 상태입니다.

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

## 페이지 & 라우트

| 경로 | 설명 |
|---|---|
| `/` | 랜딩 페이지 (3개 화면으로 링크) |
| `/write` | 1단계 — 학번+이름 로그인 → 배정된 2문제 알고리즘 작성/제출. 이미 실행된 본인 제출물이 있으면 "실행 결과 리뷰 카드"를 먼저 보여줌. 제출 완료 후에는 수정/재제출 가능 |
| `/execute` | 2단계 — 학번+이름 로그인 → (교사가 2단계를 열기 전이면 대기 안내) 배정된 2문제를 순서대로 실행 → 최종 답 제출 → 같은 화면에서 결과/평가로 전환 → 다음 라운드 |
| `/teacher` | 교사 관리 화면 — 비밀번호 입력 후 제출 현황 대시보드 / 2단계 활성화 / 결과 리뷰(문제 유형별) / 엑셀 내보내기 |

## 핵심 구조

```
lib/assignments.ts     학번+이름 → {write:[2], execute:[2]} 하드코딩 배정 (§1)
                        ROSTER 배열만 실제 학급 명단으로 교체하면 6개 조합에
                        2명씩 자동 배치됨 (인원수가 달라져도 동일 원리로 재배치)
lib/problems/           문제 4종 로직 (랜덤 입력 생성 + 허용 행동 + 채점)
  types.ts              공통 인터페이스 (ProblemModule)
  coins.ts / cards.ts / josephus.ts / pancake.ts
  index.ts              레지스트리 (generateInstance, applyProblemAction, publicInputFor)
lib/store.ts            DB 접근 계층 (제출/시도 CRUD, 배정 로직, 채점, 교사 조회)
lib/teacherAuth.ts       교사 비밀번호 검사 (헤더 `x-teacher-password`)
lib/xlsxExport.ts        SheetJS로 4개 시트 엑셀 생성 (제출/실행기록/학생배정/단계상태)
lib/problemMeta.ts       문제 설명/라벨/작성 안내 문구 (한국어, UI에서 사용)
db/schema.ts             Drizzle 스키마 (submissions / attempts / stage_state)
db/index.ts              getDb() — D1 바인딩 + 로컬 스키마 부트스트랩
app/api/**               아래 "API 요약" 참고
app/write, app/execute,
app/teacher               페이지 (클라이언트 컴포넌트, 최소 스타일)
tests/problems.test.ts    문제별 채점/제약 유닛 테스트 (tsx --test)
tests/assignments.test.ts 배정 로직이 스펙 예시 표와 일치하는지 검증
tests/rendered-html.test.mjs  빌드 산출물이 랜딩 페이지를 정상 렌더링하는지 검증
```

## 교사 비밀번호

`/teacher`의 모든 API는 요청 헤더 `x-teacher-password`를 확인합니다. 환경변수
`TEACHER_PASSWORD`로 설정하고, 없으면 기본값 `teacher123`을 사용합니다
(`.env.example` 참고). Sites 배포 시에는 실제 값을 호스팅 플랫폼의 런타임 환경
변수로 설정하세요.

## 학급 명단 교체

`lib/assignments.ts`의 `ROSTER` 배열을 실제 학번/이름으로 교체하세요. 6가지
조합(AB↔CD, AC↔BD, AD↔BC)에 2명씩 순서대로 배정되며, 인원이 6의 배수가 아니어도
자동으로 고르게 분배됩니다(`buildAssignments`). `tests/assignments.test.ts`가
스펙 §1의 12명 예시 표와 정확히 일치하는지 확인합니다.

## API 요약

모두 `app/api/**/route.ts`. 학생용 API는 인증 없이 `studentKey`
(`"{학번} {이름}"`)로 식별하고, 교사용 API는 `x-teacher-password` 헤더가 필요합니다.

- `POST /api/student/login` — 학번+이름 → 배정 + 1단계 진행 상황
- `GET /api/write/next?studentKey=` / `POST /api/write/submit` — 1단계 조회/제출(업서트)
- `GET /api/stage` — 2단계 활성화 여부
- `POST /api/execute/assign` — 다음 실행 대상 배정 (waiting/finished/noneAvailable/ready)
- `POST /api/execute/action` — 문제별 허용 행동 실행 (좌/우 저울 올리기, 저울질,
  카드 뒤집기, 사람 제거, 팬케이크 뒤집기 등 — `lib/problems/*.ts`의 `actions` 참고)
- `POST /api/execute/unexecutable` — "실행 불가" 사유 기록 (진행 막지 않음)
- `POST /api/execute/submit-answer` — 최종 숫자 제출 → 채점 결과 반환
- `POST /api/execute/evaluate` — 평가 문항 제출
- `POST /api/teacher/stage2` — 2단계 활성화
- `GET /api/teacher/dashboard` / `GET /api/teacher/review` — 대시보드 / 결과 리뷰
- `GET /api/teacher/export` — xlsx 다운로드

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

- 학생 인증은 학번+이름 문자열 일치뿐입니다(교실 활동용 경량 설계, 스펙 의도와 일치).
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
- `wrangler.jsonc`는 사용하지 않습니다.

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
