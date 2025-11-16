# 식사 약속 조회 프런트엔드 구현 명세

## 1. 목적과 범위
- 본 명세는 `meal-appointment-view-appointment-user-spec.md`와 `meal-appointment-view-appointment-uiux-spec.md`를 만족하는 React + Tailwind 기반 약속 조회 단일 페이지 구현 지침을 정의한다.
- 페이지는 공유 링크 `/appointments/:appointmentId`로만 접근하며, 응답 생성·수정, 관리자 편집 흐름은 포함하지 않는다.
- 레이아웃, 컬러, 상태 표현은 `agent/specs/samples/meal-appointment-view-appointment-uiux-sample.html`과 UI/UX 명세를 기준으로 Tailwind 유틸리티와 CSS 변수로 재현한다.

## 2. 라우팅 및 진입 구조
- `web-client/src/pages/App.tsx`는 React Router `BrowserRouter`를 도입해 다음 라우트를 정의한다.
  - `/appointments/:appointmentId` → `ViewAppointmentPage`.
  - `/` → `/appointments/demo` 리다이렉트(임시), 이후 실제 공유 ID가 전달되지 않으면 안내 메시지를 포함한 빈 상태를 보여준다.
  - 나머지 경로(`*`)는 404 안내 카드로 연결한다.
- `App.tsx`는 전역 `QueryClientProvider`와 `ReactQueryDevtools`(개발 모드 한정)를 감싼 뒤 `ViewAppointmentPage`를 렌더링한다.
- 공유 링크 파라미터는 `useParams`로 읽어 `ViewAppointmentPage`에 `appointmentId` prop으로 전달한다. 빈 문자열이거나 존재하지 않을 경우 즉시 "약속을 찾을 수 없습니다" 상태를 표시하고 API 호출을 생략한다.

## 3. 데이터 계약 및 타입 정의
- `src/features/view-appointment/types.ts`에 API 계약을 반영한 타입을 선언한다.
```ts
export type AppointmentSummary = {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  timeSlotTemplateId: string;
};

export type TemplateRule = {
  dayPattern: string;
  mealTypes: string[];
};

export type AppointmentTemplate = {
  id: string;
  name: string;
  description: string;
  rules: TemplateRule[];
};

export type Participant = {
  participantId: string;
  nickname: string;
  submittedAt: string;
  responses: string[]; // slotKey 목록
};

export type SlotSummary = {
  slotKey: string; // YYYY-MM-DD#MEALTYPE
  date: string; // YYYY-MM-DD
  mealType: 'BREAKFAST' | 'BRUNCH' | 'LUNCH' | 'TEATIME' | 'DINNER' | 'MIDNIGHT' | string;
  availableCount: number;
  availabilityRatio: number; // 0~1
};

export type AppointmentAggregates = {
  participantCount: number;
  slotSummaries: SlotSummary[];
};

export type AppointmentViewResponse = {
  appointment: AppointmentSummary;
  template: AppointmentTemplate;
  participants: Participant[];
  aggregates: AppointmentAggregates;
};
```
- 클라이언트 파생 타입
  - `SlotDisplayModel`: `slotKey`, `localDateLabel`, `weekday`, `mealLabel`, `availableCount`, `participantCount`, `ratioPercent`, `statusTone`(primary/warning/error), `templateName`.
  - `ParticipantSlotMatrix`: `{ participantId: string; nickname: string; submittedAt: Date; responseSet: Set<string>; }`.

## 4. 데이터 조회 및 캐싱 전략
- API 기본 경로는 기존 패턴(`const API_BASE_URL = globalThis.__API_BASE_URL__ ?? 'http://localhost:4000/api';`)을 재사용한다.
- `src/features/view-appointment/api.ts`에 `fetchAppointment(appointmentId: string)` 함수를 구현한다.
  - `GET ${API_BASE_URL}/appointments/${appointmentId}` 호출.
  - `response.ok`가 아니면 JSON을 파싱해 `{ status, body }` 형태의 `HttpError`를 throw하여 UI에서 404/500/503 메시지를 구분할 수 있게 한다.
  - `AbortController`를 지원해 탭 이동 시 요청을 취소한다.
- React Query 구성 (`useAppointmentQuery`):
  - `queryKey: ['appointment', appointmentId]`.
  - `enabled: Boolean(appointmentId)`.
  - `staleTime: 60_000`, `retry(failureCount, error)`: 0 for 404, 1 otherwise.
  - `select` 단계에서 `slotSummaries` 정렬, `ratioPercent`(0~100) 계산, `participantCount` 0인 경우 ratio 0 처리.
  - `refetchOnWindowFocus: false`, 대신 앱 바 `재시도` 버튼과 에러 배너의 `다시 시도` 버튼이 `queryClient.invalidateQueries`를 호출한다.
- 데이터 수신 후 `document.title = `${appointment.title} · 식사 약속``로 설정한다.

## 5. 파생 데이터 및 포맷팅 규칙
- 날짜/요일 표시: `Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' })`를 사용해 `05.12(목)` 형식으로 표기한다.
- 식사 구분 라벨: 맵 `{ BREAKFAST: '아침', BRUNCH: '브런치', LUNCH: '점심', TEATIME: '티타임', DINNER: '저녁', MIDNIGHT: '야식' }`. 미정의 값은 원문 노출.
- 슬롯 정렬 우선순위: `date` 오름차순 → `mealTypeOrder`(`BREAKFAST`=0, `BRUNCH`=1, `LUNCH`=2, `TEATIME`=3, `DINNER`=4, `MIDNIGHT`=5, default=9).
- 응답률 색상 규칙(퍼센트 기준):
  - `>= 70%` → Primary.
  - `40%~69%` → Warning.
  - `< 40%` → Error.
- 참가자 상세 탭에서 슬롯 메트릭을 표시할 때 `slotKey` → `dateLabel + mealLabel` 문자열로 변환한다.
- "템플릿 기반 슬롯만 표시" 안내는 템플릿 이름과 함께 `template.description`을 그대로 노출한다.

## 6. 컴포넌트 구조와 책임
### 6.1 상위 레이어
- `src/pages/ViewAppointmentPage.tsx`
  - `appointmentId` prop을 받고 `useAppointmentQuery`를 호출.
  - UI 상태 분기: loading → skeleton, error → `ErrorState`, success → 컨텐츠.
  - `useMemo`로 `slotDisplayList`, `participantMatrix`, `slotKeyToParticipants`를 생성해 하위 컴포넌트에 전달.
  - `activeTab`(`'overview' | 'slotDetails'`) 상태를 관리.

- `src/features/view-appointment/components/ViewAppointmentLayout.tsx`
  - 상단 앱 바, 컨테이너, 푸터를 구성하는 프레젠테이션 래퍼.
  - 상단 앱 바 버튼 콜백(`onRetry`, `onShare`, `onOpenRespond`)을 prop으로 전달받는다.

### 6.2 핵심 컴포넌트
1. **`AppointmentAppBar`**
   - Props: `{ title: string; isLoading: boolean; onRetry(): void; onShare(): void; onRespond(): void; }`.
   - 로딩 중에는 재시도 버튼 대신 스피너 아이콘을 보여준다.
   - 모바일에서는 overflow 메뉴(`...`)를 통해 액션을 표시한다.

2. **`AppointmentOverviewCard`**
   - Props: `{ appointment: AppointmentSummary; template: AppointmentTemplate; participantCount: number; lastFetchedAt: string | null; }`.
   - 메타 정보 줄: 생성일, 마지막 업데이트, 참여자 수.
   - 템플릿 안내 배지와 `template.description` 텍스트를 포함한다.

3. **`SlotSummaryGrid`**
   - Props: `{ slots: SlotDisplayModel[]; isLoading: boolean; }`.
   - 1120px 이상 3열, 768~1119px 2열, 이하 1열.
   - 각 카드에 날짜/요일, 식사 배지, 응답 수/가능 인원/응답률을 표시한다.
   - 템플릿 이름 라벨과 슬롯 키 tooltip(`slotKey`)을 제공.

4. **`ParticipantsSection`**
   - Props: `{ participants: ParticipantSlotMatrix[]; slots: SlotDisplayModel[]; activeTab: 'overview' | 'slotDetails'; onTabChange(tab): void; }`.
   - 탭 헤더는 `role="tablist"`와 키보드 조작을 지원.
   - `overview` 탭: 카드 리스트 (닉네임, 마지막 응답 시각, 선택 슬롯 배지 `chip`).
   - `slotDetails` 탭: 테이블 (데스크톱) + 카드형(모바일). 각 교차 셀은 `responseSet.has(slot.slotKey)` 여부에 따라 `가능/미정` 상태 아이콘을 렌더링한다.
   - 응답자가 0명일 경우 빈 상태 컴포넌트(`EmptyState` 아이콘 + 텍스트) 표시.

5. **`StatusBanner`**
   - 로딩/오류/빈 상태 메시지 재사용. Props: `{ type: 'loading' | 'error' | 'empty'; message: string; actionLabel?: string; onAction?(): void; }`.

6. **`SkeletonLoader`**
   - 약속 개요, 슬롯 카드, 탭 영역 각각에 대응하는 3종 스켈레톤을 제공. Pulse 애니메이션(`animate-pulse`) 사용.

### 6.3 유틸리티
- `src/features/view-appointment/utils/slot.ts`: `parseSlotKey`, `formatSlotLabel`, `buildSlotDisplayList(slotSummaries, participantCount)`.
- `src/features/view-appointment/utils/share.ts`: `shareAppointment(url: string)` → Web Share API (`navigator.share`) 우선, 실패 시 Clipboard API 사용, 모두 실패하면 `Promise.reject`.

## 7. 로딩, 오류, 빈 상태 처리
- **로딩**: 페이지 전체 스켈레톤 + 앱 바 스피너. 최소 600ms 동안 유지해 깜박임 방지.
- **404**: 일러스트 아이콘 + "약속을 찾을 수 없습니다" 메시지 + "링크 다시 확인" 부연 설명. `재시도` 버튼은 숨긴다.
- **503/500/네트워크 오류**: 상단 고정 배너(`role="alert"`) + 재시도 버튼. 기존 데이터가 있다면 유지하고, 로딩 실패 후에도 마지막 성공 데이터를 표시한다 (`useQuery`의 `data` vs `error`).
- **참여자 없음**: `ParticipantsSection` 내부에 중립 빈 상태 카드.
- **슬롯 데이터 없음**: `SlotSummaryGrid`에 "표시할 슬롯이 없습니다" 메시지와 템플릿 안내 배지를 표시한다.

## 8. 주요 상호작용
- **재시도**: 앱 바 버튼과 오류 배너 모두 `refetch()` 호출. 클릭 시 버튼 disabled + 스피너 표시.
- **공유**: 현재 URL(`window.location.href`) 복사. 성공 시 3초 지속 토스트(`role="status"`). 실패 시 오류 배너.
- **응답 작성 이동**: `href=/appointments/:appointmentId/respond` placeholder 링크를 제공하되, 아직 페이지가 없으므로 `preventDefault` 후 안내 모달 "응답 기능 준비 중" 노출.
- **탭 키보드 조작**: 좌/우 화살표로 이동, Enter/Space로 활성화.
- **슬롯 카드 툴팁**: `title` 속성으로 slotKey 노출. 클릭 시 별도 액션 없음.

## 9. 스타일 토큰 및 Tailwind 구성
- `src/index.css`에 아래 CSS 변수를 정의하고 루트에 적용한다.
  | 변수 | 값 | 용도 |
  | --- | --- | --- |
  | `--color-primary` | `#2E7D32` | 재시도 버튼, 강조 텍스트 |
  | `--color-secondary` | `#1565C0` | 공유 버튼, 탭 활성 |
  | `--color-background` | `#F5F7F8` | 페이지 배경 |
  | `--color-surface` | `#FFFFFF` | 카드 배경 |
  | `--color-border` | `#E0E3E7` | 카드/테이블 경계 |
  | `--color-success` | `#1B5E20` | 높은 응답률 |
  | `--color-warning` | `#F9A825` | 보통 응답률 |
  | `--color-error` | `#C62828` | 오류 메시지 |
- `tailwind.config.ts`의 `theme.extend`에 위 색상, `maxWidth: { 'layout': '1120px' }`, `boxShadow` 프리셋(`app-card`, `app-bar`), `borderRadius`(`xl: '16px'`)를 추가한다.
- 전역 배경: `className="min-h-screen bg-[color:var(--color-background)]"`.
- 카드: `bg-[color:var(--color-surface)] rounded-2xl shadow-[0_12px_24px_rgba(15,23,42,0.08)] border border-[color:var(--color-border)] p-7`.
- Slot 카드 상태 배경:
  - Primary: `text-[color:var(--color-primary)] bg-[rgba(46,125,50,0.12)]`.
  - Warning: `text-[color:var(--color-warning)] bg-[rgba(249,168,37,0.16)]`.
  - Error: `text-[color:var(--color-error)] bg-[rgba(198,40,40,0.1)]`.
- 반응형 규칙: Tailwind 브레이크포인트(`lg: 1024px`, `md: 768px`, `sm: 640px`)를 사용해 UI/UX 명세의 데스크톱/태블릿/모바일 동작을 재현한다.

## 10. 접근성 및 반응형 세부사항
- Landmark: `<header>`, `<main>`, `<section>`/`aria-labelledby`, `<footer>` 구조를 유지한다.
- 포커스 스타일: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-secondary)]` 공통 적용.
- 로딩/오류 배너는 `role="status"`/`role="alert"`를 설정해 스크린 리더에게 즉시 전달한다.
- 응답자 테이블은 `aria-label="슬롯별 응답 현황"`, sticky 헤더(`sticky top-0`)를 설정하고, 모바일에서는 `<dl>` 리스트로 전환한다.
- 긴 닉네임은 `max-w-[220px] truncate` 처리하되 `title` 속성으로 전체 텍스트 제공.
- 탭 전환 시 `aria-selected`, `tabIndex`, `id`/`aria-controls` 연결을 준수한다.

## 11. 테스트 요구사항
- `src/tests/view-appointment/ViewAppointmentPage.test.tsx`
  - 초기 로딩 시 스켈레톤/앱 바 스피너가 나타나는지 확인.
  - 성공 응답 목킹(전역 `fetch` mock) 후 제목, 슬롯 카드 개수, 탭 콘텐츠가 정확히 렌더링되는지 검증.
  - 응답률 색상 분기(>70%, 40~69, <40)별 클래스 적용을 확인.
  - 404 응답 시 Not Found 메시지와 재시도 버튼 비표시를 검증.
  - 503 응답 → 오류 배너 + 재시도 버튼 클릭 시 `fetch` 재호출 확인.
  - 공유 버튼 클릭 시 `navigator.clipboard.writeText` 또는 `navigator.share` 호출 spy 검증.
- `src/tests/view-appointment/ParticipantsSection.test.tsx`
  - 탭 키보드 내비게이션, slotDetails 테이블 표시, 빈 상태 메시지를 테스트.
- E2E(`playwright.e2e.config.ts`): `tests/view-appointment/view-appointment.spec.ts`
  - `GET /appointments/demo`를 MSW 없이 Playwright `route.fulfill`로 목킹하고, 탭 전환/재시도/공유(클립보드 권한 제한 시 스킵) 시나리오를 검증.

## 12. 관련 문서 및 레퍼런스
- 사용자 요구: `agent/specs/meal-appointment-view-appointment-user-spec.md`.
- UI/UX 및 시각 레퍼런스: `agent/specs/meal-appointment-view-appointment-uiux-spec.md`, `agent/specs/samples/meal-appointment-view-appointment-uiux-sample.html`.
- 백엔드 계약: `agent/specs/meal-appointment-view-appointment-backend-spec.md`.
- 전반적 아키텍처 규칙: `agent/specs/meal-appointment-architecture-spec.md`.
