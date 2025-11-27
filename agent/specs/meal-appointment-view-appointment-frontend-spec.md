# 식사 약속 조회 프런트엔드 구현 명세

## 1. 목적과 범위
- 본 문서는 `meal-appointment-view-appointment-user-spec.md`와 `meal-appointment-view-appointment-uiux-spec.md`, 샘플 목업(`agent/specs/samples/meal-appointment-view-appointment-uiux-sample.html`)을 토대로 React 기반 조회 페이지 구현 지침을 정의한다.
- 페이지는 로그인 없이 `/appointments/:appointmentId` 경로에서 약속 세부 정보와 응답 현황을 조회하는 데 초점을 맞춘다. 응답 생성/수정, 관리자 편집, 닉네임 등록 흐름은 명세 범위에 포함되지 않는다.
- 디자인 토큰과 컴포넌트 구조는 기존 Tailwind 설정을 확장하며, API 계약은 `meal-appointment-view-appointment-backend-spec.md`의 `GET /api/appointments/{id}` 응답을 단일 소스로 사용한다.

## 2. 라우팅 및 엔트리 포인트
- `src/pages/App.tsx`
  - React Router에 `/appointments/:appointmentId` 경로를 추가하고, 해당 라우트에서 `ViewAppointmentPage`를 렌더링한다.
  - 기존 `/` → `/create` 리다이렉트는 유지하되, 조회 링크 공유 시 정적 호스트가 `BrowserRouter`를 지원하도록 `basename`은 비워둔다.
- 새 페이지 컴포넌트 및 기능 디렉터리
  - `src/pages/ViewAppointmentPage.tsx`: 상위 레이아웃, 데이터 훅 호출, 상태별 분기 렌더링.
  - `src/features/view-appointment/api/getAppointment.ts`: fetch 래퍼와 응답 타입 정의.
  - `src/features/view-appointment/hooks/useAppointmentQuery.ts`: React Query `useQuery` 기반 데이터/상태 훅.
  - `src/features/view-appointment/components/*`: UI 세부 컴포넌트(AppBar, OverviewCard, SlotSummaryGrid, ParticipantTabs 등).
  - `src/features/view-appointment/utils/*`: `formatSlot`, `groupSlotSummaries`, `buildParticipantMatrix` 등의 순수 함수.
  - `src/features/view-appointment/strings.ts`: 고정 카피를 한곳에 정의하여 향후 다국어 확장 대비.

## 3. 디자인 토큰과 스타일 가이드 적용
- `src/index.css`에 조회 화면 전용 토큰을 추가하고 Tailwind `theme.extend.colors`를 업데이트한다.
  | CSS 변수 | 값 | 용도 |
  | --- | --- | --- |
  | `--color-view-primary` | `#2E7D32` | 기본 버튼, 강조 텍스트 |
  | `--color-view-secondary` | `#1565C0` | 공유 버튼, 탭 활성 |
  | `--color-view-neutral` | `#F5F7F8` | 페이지 배경 |
  | `--color-view-border` | `#E0E3E7` | 카드 경계선 |
  | `--color-view-warning` | `#F9A825` | 응답률 경고 |
  | `--color-view-error` | `#C62828` | 오류 배너 |
- Tailwind 클래스 매핑
  - 기본 컨테이너: `max-w-[1120px] mx-auto px-6 py-10 space-y-8 sm:px-6 lg:px-8 bg-[var(--color-view-neutral)]`.
  - 카드: `bg-white rounded-2xl border border-[var(--color-view-border)] shadow-[0_12px_24px_rgba(15,23,42,0.08)] p-7 sm:p-6`.
  - 앱 바: `sticky top-0 z-10 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] h-16 flex items-center gap-4 px-6`.
  - 버튼: `rounded-xl font-semibold px-4 py-2 focus-visible:outline-4 focus-visible:outline-offset-2` + 토큰 색상(`bg-[var(--color-view-primary)]`, `bg-[var(--color-view-secondary)]`).
- 폰트와 타이포그래피는 Pretendard/Inter 기반으로 UI/UX 명세의 크기(H1 28px, H2 22px, Body 16px, Caption 14px)를 Tailwind `text-[size] font-[weight]` 조합으로 재현한다.

## 4. 데이터 연동 및 상태 흐름
- `useAppointmentQuery({ appointmentId, apiBaseUrl })`
  - `queryKey = ['appointment', appointmentId]`.
  - `queryFn`은 `fetch(
      new URL(`/appointments/${appointmentId}`, apiBaseUrl)
    )`를 호출하고 HTTP 오류 시 `throw`.
  - `retry`는 1회, `staleTime`은 30초.
  - 응답 타입: `AppointmentViewResponse` (백엔드 명세의 `appointment`, `template`, `participants`, `aggregates`).
  - 훅은 `status`, `data`, `error`, `refetch` 외에 파생 데이터(`slotGroups`, `participantMatrix`)를 반환해 상위 컴포넌트에서 재사용한다.
- 데이터 파생 규칙
  - `slotSummaries`를 날짜 기준으로 그룹화하고, 각 항목에 UI 표시 필드(`displayDate`, `weekdayLabel`, `mealLabel`, `ratioLabel`, `ratioTone`)를 주입.
  - `participants` 배열과 `slotSummaries`의 `slotKey`를 교차해 `Map<slotKey, ParticipantNickname[]>`을 생성하여 "슬롯별 상세" 탭에 사용.
  - `participantCount === 0`인 경우 응답률은 0%로 표시하고 빈 상태 카피를 함께 노출한다.

## 5. 컴포넌트 구조
1. **`ViewAppointmentPage`**
   - `useParams`로 `appointmentId` 획득, `useAppointmentQuery` 호출.
   - 상태 분기: `isLoading` → 스켈레톤, `isError` → 오류 배너, `data` → 실제 화면.
   - `handleRetry = () => refetch({ cancelRefetch: false })`를 `AppBar`와 오류 배너에 전달.
2. **`ViewAppointmentAppBar`**
   - Props: `title`, `onRetry`, `onShare`, `onNavigateToRespond?`.
   - 데스크톱에서는 `재시도`, `공유 링크 복사`, `응답 작성하기` 버튼을 나열. 모바일(`max-width: 640px`)에서도 동일 버튼을 바로 노출하되, 줄바꿈/여백으로 겹치지 않도록 배치한다.
   - `onShare`는 현재 URL을 복사(`navigator.clipboard.writeText(window.location.href)`), 실패 시 토스트 오류.
3. **`AppointmentOverviewCard`**
   - 제목, 설명, 생성/업데이트 메타, 템플릿 배지("템플릿 기반 슬롯만 표시").
   - 날짜 포맷은 `Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })`.
4. **`SlotSummaryGrid`**
   - `slotGroups`를 순회해 카드 렌더.
   - 카드 구성: 날짜 헤더, 식사 배지, 통계 배지(`응답`, `가능`, `응답률`), 템플릿 설명.
   - 응답률 강조 규칙: ≥70% Primary, 40~69% Warning, <40% Error(텍스트 대비 확보 위해 `text-[#8A1C1C]`, 배경 `bg-[rgba(198,40,40,0.08)]`).
   - 레이아웃: desktop 3열(`grid-cols-3`), tablet 2열(`md:grid-cols-2`), mobile 1열.
5. **`ParticipantTabs`**
   - 두 개 탭(`응답자 목록`, `슬롯별 상세`).
   - 탭 패널은 `role="tabpanel"`과 키보드 이동(`ArrowLeft/Right`).
   - `응답자 목록`: 카드 리스트(닉네임, 마지막 응답 시각, 선택 슬롯 배지). 슬롯 배지는 `slotKey`를 날짜+식사 라벨로 포맷.
   - `슬롯별 상세`: 데스크톱에서는 테이블(`table-fixed`, sticky header), 모바일에서는 슬롯별 카드 내부에 응답자 태그를 감싼 리스트.
6. **`StatusMessage`**
   - 로딩 스켈레톤 컴포넌트(`animate-pulse`), 오류 배너(`role="alert"`), 빈 상태 아이콘(`svg` + 캡션) 재사용을 위한 유틸 컴포넌트.

## 6. 상태, 오류, 빈 상태 처리
- **로딩**: 
  - 앱 바 오른쪽에 16px 스피너(`aria-live="polite"`), 카드 영역에는 스켈레톤 레이어(회색 블록 3줄) 표시.
- **오류**:
  - HTTP 404 → 전체 화면 카드 대신 `EmptyState` 메시지 "약속을 찾을 수 없습니다" + `onRetry`.
  - HTTP 503/500 → 오류 배너에 "일시적인 문제로 약속 정보를 불러오지 못했습니다." 및 `재시도` 버튼.
  - `useAppointmentQuery`의 `error` 객체를 `ErrorBoundaryState`로 맵핑해 코드별 메시지 분기.
- **데이터 없음**:
  - `participants.length === 0` → 응답자 탭 상단에 "아직 응답이 없습니다" 정보 배너.
  - `slotSummaries` 길이 0 → 슬롯 영역에 템플릿 재시도 안내 메시지를 표시하고 `onRetry` 버튼을 노출.

## 7. 상호작용과 접근성
- `재시도` 버튼: `aria-label="데이터 다시 불러오기"`, 클릭 시 `refetch` 실행.
- `공유 링크 복사`: `aria-live="polite"` 토스트로 결과 안내, 성공 시 "링크를 복사했어요" 메시지를 3초간 표시.
- `응답 작성하기` 버튼(선택): `/respond/:appointmentId` 경로가 준비되지 않았으므로 임시로 `href="/appointments/:appointmentId/respond"` 또는 외부 문구 "준비 중" 토스트.
- 키보드 포커스 스타일은 `focus-visible:ring-2 focus-visible:ring-[var(--color-view-secondary)] focus-visible:ring-offset-2` 공통 적용.
- 표에는 `aria-describedby`를 연결해 슬롯 설명을 스크린리더에 제공하고, 오류 배너는 `role="alert"`로 즉시 읽힌다.

## 8. 반응형 동작
| 브레이크포인트 | 동작 |
| --- | --- |
| ≥1024px | 슬롯 카드 3열, 탭 헤더 좌우 정렬, 참가자 테이블 가로 스크롤 허용 |
| 768–1023px | 슬롯 카드 2열, 앱 바 액션 버튼 텍스트 축약, 테이블 최소 폭 720px + 수평 스크롤 |
| ≤767px | 단일 컬럼, 탭 헤더 스와이프 가능한 pill 목록, 테이블은 카드 리스트로 변환 |
- `useMediaQuery` 없이 CSS 유틸리티(`md:`, `lg:`)로 처리하고, 테이블 → 카드 변환은 CSS `grid`와 조건부 렌더링으로 구현한다.

## 9. 테스트 및 관측
- Vitest + Testing Library: `src/tests/view-appointment/ViewAppointmentPage.test.tsx`
  - 성공 시 슬롯 카드 개수와 응답자 탭 콘텐츠가 정확히 표시되는지 검증.
  - 404/503/네트워크 오류 케이스를 mock fetch로 검증하고, `재시도` 클릭 시 `fetch`가 재호출되는지 spy.
  - 모바일 뷰 스냅샷은 `window.resizeTo`로 뷰포트를 축소한 뒤 탭 전환 시 카드 뷰로 전환되는지 확인.
- Playwright E2E(`playwright.e2e.config.ts`): 
  - `/appointments/{id}` 로딩, 공유 버튼 클릭 시 클립보드 권한 mock, 탭 전환 동작을 시나리오로 추가.

## 10. 관련 문서 연계
- `meal-appointment-view-appointment-user-spec.md`: 약속 개요, 슬롯 정렬, 응답 요약/상세 표시 규칙을 준수한다.
- `meal-appointment-view-appointment-uiux-spec.md`: 레이아웃, 색상 토큰, 상태 메시지 패턴을 그대로 재현한다.
- `meal-appointment-view-appointment-backend-spec.md`: 데이터 필드(`slotKey`, `participants.responses`, `aggregates.slotSummaries`)를 그대로 소비하고, 재시도/오류 메시지 흐름을 동일하게 유지한다.
- `meal-appointment-domain-spec.md`: 템플릿 기반 슬롯 계산 규칙을 참고하여 `slotKey` 파싱 및 정렬을 구현한다.
