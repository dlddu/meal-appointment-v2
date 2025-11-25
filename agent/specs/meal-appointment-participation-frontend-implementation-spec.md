# 식사 약속 참여 프런트엔드 구현 명세

## 1. 목적과 범위
- 본 문서는 `meal-appointment-participation-user-spec.md`, `meal-appointment-participation-uiux-spec.md`, 샘플 목업(`agent/specs/samples/meal-appointment-participation-uiux-sample.html`)을 토대로 React 기반 참여 페이지의 구현 지침을 정의한다.
- 공유 링크(`/appointments/:appointmentId`)로 접근한 사용자가 닉네임(필수)과 선택적 PIN을 입력해 참여 세션을 생성/재사용하고, 주간 템플릿 슬롯에 대한 가용성을 제출·수정하는 UI를 범위로 한다.
- 약속 생성/조회 기능은 맥락 제공 수준으로만 참조하며, 관리자 편집·확정·알림은 제외한다.

## 2. 라우팅 및 엔트리 구조
- `src/pages/App.tsx`
  - 기존 `/create`, `/appointments/:appointmentId` 라우트에 더해 `/appointments/:appointmentId/participate` 경로를 추가한다. 공유 링크 기본값은 `/appointments/:appointmentId`로 두고, 참여 CTA에서 `/participate`로 이동시키는 방식을 허용한다.
  - 참여 페이지를 지연 로드할 경우 `lazy(() => import('./ParticipateAppointmentPage'))` + `Suspense` 스켈레톤을 사용한다.
- 주요 파일 배치
  - `src/pages/ParticipateAppointmentPage.tsx`: 상위 레이아웃, 데이터 훅 호출, 상태 분기 렌더링.
  - `src/features/participation/api/{createParticipant.ts, submitAvailability.ts, getAppointmentTemplate.ts}`: POST/PUT/GET fetch 래퍼와 타입 정의.
  - `src/features/participation/hooks/useParticipationFlow.ts`: React Query `useQuery` + `useMutation` 조합으로 약속 메타 로딩, 닉네임 검증, 응답 제출 흐름을 캡슐화.
  - `src/features/participation/components/*`: UI 세부 컴포넌트(AppBar, ParticipantCard, WeekNavigator, SlotGrid, SummaryPanel, ToastStack 등).
  - `src/features/participation/utils/{slotKey.ts, storage.ts}`: 슬롯 포맷/정렬, LocalStorage 저장/불러오기 헬퍼.
  - `src/features/participation/strings.ts`: 안내 문구, 오류 메시지, 버튼 라벨 상수.

## 3. 디자인 토큰 및 스타일 적용
- `src/index.css` 또는 Tailwind `theme.extend`에 UI/UX 명세의 토큰을 추가한다.
  | CSS 변수 | 값 | 용도 |
  | --- | --- | --- |
  | `--participation-primary` | `#2E7D32` | 제출 버튼, 선택된 슬롯 |
  | `--participation-secondary` | `#1565C0` | 주간 내비 버튼, 도움말 아이콘 |
  | `--participation-neutral-100` | `#F5F7F8` | 페이지/슬롯 영역 배경 |
  | `--participation-neutral-50` | `#EEF1F4` | 비활성 슬롯 배경 |
  | `--participation-border` | `#E0E3E7` | 카드/슬롯 테두리 |
  | `--participation-success` | `#1B5E20` | 제출 성공 텍스트/배지 |
  | `--participation-warning` | `#F9A825` | 덮어쓰기 경고, 응답률 경고 |
  | `--participation-error` | `#C62828` | 검증 오류 및 경고 배지 |
- 공통 유틸리티 조합
  - 페이지 컨테이너: `max-w-[1120px] mx-auto px-6 py-10 space-y-8 sm:px-4 bg-[var(--participation-neutral-100)]`.
  - 카드: `bg-white rounded-2xl border border-[var(--participation-border)] shadow-[0_12px_24px_rgba(15,23,42,0.08)] p-7 sm:p-6`.
  - 포커스 스타일: `focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[rgba(21,101,192,0.45)]`.
  - 타이포그래피: Pretendard/Inter, H1 28px/600, H2 22px/600, Body 16px/400, Caption 14px/400.

## 4. 데이터 흐름 및 상태 관리
- `useParticipationFlow({ appointmentId, apiBaseUrl })`
  - `queryKey = ['appointment', appointmentId, 'participation']`로 약속 메타와 템플릿 슬롯을 로드한다(`GET /api/appointments/{id}` 또는 별도 템플릿 전용 엔드포인트를 재사용).
  - `createParticipant`(`POST /api/appointments/{id}/participants`): 닉네임/PIN 검증 및 기존 응답 불러오기. 성공 시 `participantId`, `hasPin`, `responses`, `submittedAt` 상태를 설정.
  - `submitAvailability`(`PUT /api/appointments/{id}/participants/{participantId}/responses`): 선택 슬롯 배열 전송. 응답의 `selected`와 `summary`를 상태에 반영해 UI 집계 갱신.
  - 로컬 상태: `nickname`, `pin`, `selectedSlots`, `isPersistedLocally`(토글), `lastSubmittedAt`, `errorState`를 `useReducer` 또는 Zustand 등으로 관리하고, React Query는 서버 동기화에 집중한다.
  - `staleTime` 30초, `retry` 1회. 네트워크 오류 시 기존 선택 상태를 유지하고 재시도 핸들러를 노출한다.

## 5. 컴포넌트 구조 및 책임
1. **`ParticipateAppointmentPage`**
   - `useParams`로 `appointmentId` 확보 → `useParticipationFlow` 호출.
   - 상태 분기: 로딩 스켈레톤 → 오류 배너(`404`/`5xx` 분기) → 데이터 렌더.
   - `onRetry`는 `refetch({ cancelRefetch: false })`를 호출해 앱 바와 오류 배너에서 재사용.
2. **`ParticipationAppBar`**
   - 브랜드/제목, 도움말 버튼, `새로고침` 버튼을 제공. 모바일에서는 액션을 오버플로 메뉴로 묶는다.
   - `onHelp`는 모달을 열어 닉네임 규칙·PIN 안내를 표시.
3. **`ParticipantInfoCard`**
   - 입력 필드: 닉네임(Text), PIN(Password, 선택), "현재 기기 저장" 토글.
   - 상태 배지: 기존 응답 불러오기 성공 시 `Success` 배지 + 제출 시각, PIN 불일치/닉네임 충돌 시 `Error` 배지.
   - `참여 시작` 버튼 클릭 시 `createParticipant` 실행, 성공 후 슬롯 영역 활성화.
4. **`WeekNavigator`**
   - 이전/다음 주 버튼과 현재 주 범위 텍스트. 데스크톱에서는 버튼 텍스트, 모바일에서는 아이콘만 노출.
   - 무한 주간 탐색을 위해 가상 리스트나 날짜 오프셋 상태(`weekOffset`)로 슬롯 렌더링 범위를 전환.
5. **`SlotGrid`**
   - 열=요일, 행=템플릿 식사 슬롯(아침/점심/저녁 등). 슬롯 버튼에 선택/비선택/비활성 상태 스타일을 적용.
   - 각 슬롯 카드 우측 상단에 집계 배지(`가능 인원 / 총 응답자`, 색상은 응답률에 따라 Success/Warning/Error) 표시.
   - 모바일에서는 요일별 수평 스크롤 카드로 전환하고, 현재 요일 헤더를 sticky로 유지.
6. **`SummaryPanel`**
   - 선택된 슬롯 수, 미선택 슬롯 수, 마지막 제출 시각, 기존 응답 덮어쓰기 경고를 표시.
   - CTA: `가용 시간 제출`(Primary) + `초기화`(텍스트 버튼). 제출 후 성공 토스트와 타임스탬프 업데이트.
7. **`ToastStack` & `InlineStatus`**
   - `aria-live="polite"` 토스트로 성공/오류/경고를 노출. 오류 토스트에는 요청 ID 또는 HTTP 코드 캡션 포함.
   - 인라인 오류 메시지는 입력 하단에 배치하고, 서버 검증 오류와 매핑한다.

## 6. 입력·검증·클라이언트 UX 규칙
- 닉네임: `trim()` 후 1~30자, 중복 불가. 클라이언트 측에서 빈 값/길이 초과 시 즉시 오류 메시지, 서버의 `NICKNAME_TAKEN` 시 안내 배지.
- PIN: 미입력 허용, 입력 시 4~12자. 서버가 PIN을 요구했는데 미입력/불일치면 `INVALID_PIN` 메시지를 PIN 필드 하단에 표시하고 포커스를 이동.
- 슬롯 선택: 템플릿에 존재하는 `slotKey`만 토글 가능. 비활성 슬롯은 `cursor: not-allowed` + 중립 배경.
- 제출 시 클라이언트 검증 통과 후에만 `submitAvailability` 호출하며, 실패한 필드에 `focus()`를 호출한다.
- `현재 기기 저장` 토글이 켜지면 닉네임/PIN을 LocalStorage에 암호화 없이 저장한다는 경고 캡션을 노출하고, 동의한 경우에만 저장한다.

## 7. API 오류 매핑 및 상태 메시지
- HTTP/비즈니스 코드 매핑 예시
  | 코드 | UI 동작 |
  | --- | --- |
  | `APPOINTMENT_NOT_FOUND`(404) | 전체 화면 EmptyState "약속을 찾을 수 없습니다" + 홈 이동 링크 |
  | `NICKNAME_TAKEN`(409) | 닉네임 필드 하단 오류 + 안내 배지, 슬롯 영역 비활성 유지 |
  | `INVALID_PIN`(403) | PIN 필드 오류 및 토스트, 기존 응답 불러오기 차단 |
  | `INVALID_SLOT`(400) | 토스트 + SlotGrid 경고 배지, 서버 집계 재조회 |
  | `VALIDATION_ERROR`(400) | 필드별 메시지를 매핑하여 인라인 표시 |
  | `INTERNAL_ERROR`/네트워크 | 토스트 + 재시도 버튼 노출, 입력 상태 보존 |
- `useParticipationFlow`는 오류 객체를 UI 친화적인 `ParticipationError` 모델로 변환해 컴포넌트에 전달한다.

## 8. 상호작용, 접근성, 반응형
- 키보드: SlotGrid 버튼은 요일→식사 순서로 포커스가 이동하며 Space/Enter로 토글. 주간 내비게이션은 `aria-live="polite"`로 범위를 읽어준다.
- 접근성: 모든 입력/버튼에 `aria-label` 지정, 오류 배너는 `role="alert"`, 토스트는 `aria-live` 영역에 마운트.
- 반응형: Desktop ≥1024px 7열 그리드, Tablet 4열 + 슬라이드, Mobile 단일 컬럼 + 수평 스크롤. 패딩은 모바일 16px로 축소하고 앱 바 액션은 메뉴화한다.
- 포커스 유지: 네트워크 오류나 검증 실패 시 포커스가 해당 필드에 남도록 `ref` 제어.

## 9. 저장소 및 동기화 세부 규칙
- LocalStorage 키: `participation.nickname`, `participation.pin`, `participation.lastAppointmentId`. 토글이 꺼지면 저장값을 즉시 삭제한다.
- 약속 메타/템플릿 캐싱: React Query `keepPreviousData: true`로 주간 전환 시 스켈레톤 점프를 줄이고, `onSuccess`에서 `selectedSlots`를 서버 응답의 `responses`로 재동기화한다.
- 교차 페이지 연계: 조회 페이지에서 "가용 시간 제출" CTA를 눌러 `/participate`로 이동할 때 닉네임/PIN을 URL 쿼리(`?nickname=...`)나 `sessionStorage`로 전달하는 것은 선택 사항이며, 존재하면 기본값으로 채운다.

## 10. 테스트 및 계측 지침
- 유닛/컴포넌트 테스트(Vitest + Testing Library)
  - `ParticipantInfoCard` 입력 검증, 닉네임 중복/ PIN 불일치 시 인라인 오류 노출 여부.
  - `useParticipationFlow`에서 `createParticipant` 성공 시 `responses`가 선택 상태에 매핑되는지, `submitAvailability` 후 `summary` 업데이트 여부.
  - SlotGrid 선택/해제 토글 및 집계 배지 색상 변화를 스냅샷/DOM assertion으로 검증.
- E2E(Playwright)
  - `/appointments/{id}/participate`에서 닉네임 입력 → 참여 → 슬롯 선택 → 제출 성공 토스트까지의 흐름.
  - 네트워크 오류(mock 503) 후 재시도 시 기존 선택이 유지되는지 확인.
  - 모바일 뷰포트에서 요일 슬라이드 스크롤, Sticky 헤더 동작을 캡처.
- 관측성: 제출 성공 이벤트에 `console.info` + `performance.mark/measure`를 넣어 FID/제출 소요 시간 로그를 남기고, 오류 코드별 이벤트 태그를 포함한다.

## 11. 관련 문서 연계
- `meal-appointment-participation-user-spec.md`: 닉네임 기반 참여, PIN 선택 입력, 슬롯 제출/수정 규칙을 준수한다.
- `meal-appointment-participation-uiux-spec.md`: 레이아웃, 디자인 토큰, 주간 슬롯 탐색/선택 UX를 그대로 반영한다.
- `agent/specs/samples/meal-appointment-participation-uiux-sample.html`: 카드 간격, 색상, 폰트, 배지 스타일의 레퍼런스로 사용한다.
- `meal-appointment-participation-backend-implementation-spec.md`: POST/PUT 계약과 오류 코드를 그대로 소비하고, 응답 집계(`summary.slotSummaries`)를 UI 집계에 사용한다.
