# 식사 약속 참여 프런트엔드 테스트 명세

## 1. 목적과 범위
- 본 명세는 `meal-appointment-participation-frontend-implementation-spec.md`와 `meal-appointment-architecture-spec.md`를 기반으로 `/appointments/:appointmentId/participate` 참여 화면을 검증하기 위한 프런트엔드 자동화 테스트 전략을 정의한다.
- 검증 대상은 `web-client` 워크스페이스의 참여 페이지, React Query 훅, 로컬 스토리지 유틸, 접근성 피드백, 반응형 레이아웃이다.
- 백엔드 비즈니스 로직 자체는 포함하지 않으며, 프런트엔드가 계약에 맞춰 요청/응답을 처리하고 UI/UX 명세를 충족하는지에 초점을 둔다.

## 2. 테스트 환경 전제
- 패키지 매니저: `npm`(Node.js 20 이상). 최초 실행 전 `npm install` 수행.
- 테스트 러너: Vitest. DOM 환경은 `jsdom`으로 설정하고 React Testing Library와 user-event를 기본 유틸로 사용한다.
- 네트워크 계층은 `msw`(Mock Service Worker)의 `setupServer`로 `/api/appointments/:id`, `/api/appointments/:id/participants`, `/api/appointments/:id/participants/:participantId/responses` 호출을 모킹한다.
- React Query는 테스트마다 신규 `QueryClient`를 생성하고, `afterEach` 훅에서 `queryClient.clear()`와 `cleanup()`을 호출한다.
- Playwright 기반 브라우저 E2E 테스트는 닉네임 등록, 슬롯 선택/제출, 반응형 전환과 같은 핵심 플로우를 스냅샷과 함께 검증한다.

## 3. 테스트 계층별 전략
### 3.1 단위 테스트 (Vitest + Testing Library)
- **대상**: 프레젠테이션 컴포넌트(`ParticipationAppBar`, `ParticipantInfoCard`, `WeekNavigator`, `SlotGrid`, `SummaryPanel`, `ToastStack`, `InlineStatus`), 문자열/토큰 상수(`strings.ts`), 유틸(`slotKey.ts`, `storage.ts`).
- **목표**: 의존성 최소화된 UI/로직의 조건 분기, 접근성 속성, 키보드·포커스 인터랙션, 디자인 토큰 적용 여부를 검증한다.
- **설정**: `vitest --run --config vite.config.ts --dom` 실행. 렌더 헬퍼(`renderWithProviders`)로 CSS 변수와 Tailwind 클래스가 DOM에 반영되는지 확인한다.

### 3.2 훅/상태 테스트 (Vitest)
- **대상**: `useParticipationFlow` 훅 및 내부 로컬 상태 리듀서/선택 토글 로직.
- **목표**: 쿼리 상태(`isLoading`, `isError`, `data`), `createParticipant`/`submitAvailability` 성공·오류 흐름, 로컬 스토리지 동기화 여부, 재시도 핸들러 전달을 검증한다.
- **설정**: `renderHook` + `QueryClientProvider` 래퍼. msw로 HTTP 코드(200, 403, 404, 409, 503, 네트워크 오류)를 분기 모킹하고, `vi.useFakeTimers()`로 제출 타임스탬프를 제어한다.

### 3.3 페이지 통합 테스트 (Vitest + Testing Library + msw)
- **대상**: `ParticipateAppointmentPage` 전체.
- **목표**: 데이터 로딩 → 참여자 생성 → 슬롯 선택 → 제출 → 재시도/오류 흐름을 사용자 인터랙션 기반으로 검증한다.
- **설정**: React Router `MemoryRouter`로 `/:appointmentId/participate` 파라미터를 주입하고, msw 핸들러를 상황별로 교체한다. `user-event`로 입력, 키보드 이동, 토글, 버튼 클릭을 시뮬레이션한다.

### 3.4 시각/반응형 회귀 (Playwright)
- **대상**: 참여 페이지의 `mobile`(≤767px), `tablet`(768–1023px), `desktop`(≥1024px) 레이아웃.
- **목표**: 앱 바 액션 노출 방식, 슬롯 카드 열 수/스크롤, Summary 패널 위치, Sticky 헤더 동작이 UI/UX 명세와 일치하는지 스냅샷으로 검증한다.
- **설정**: `npx playwright test --project=chromium --grep "participation"` 시나리오 추가. 스크린샷은 `__screenshots__/participation`에 저장하고, 클립보드 권한은 필요 시 `grantPermissions`로 허용한다.

## 4. 테스트 디렉터리 구조
```
web-client/
└── src/
    ├── features/participation/
    │   ├── __tests__/
    │   │   ├── ParticipationAppBar.test.tsx
    │   │   ├── ParticipantInfoCard.test.tsx
    │   │   ├── WeekNavigator.test.tsx
    │   │   ├── SlotGrid.test.tsx
    │   │   ├── SummaryPanel.test.tsx
    │   │   ├── ToastStack.test.tsx
    │   │   └── utils/{slotKey.test.ts, storage.test.ts, strings.test.ts}
    │   ├── __mocks__/participationHandlers.ts
    │   └── hooks/__tests__/useParticipationFlow.test.ts
    └── tests/participation/
        └── ParticipateAppointmentPage.test.tsx
```
- Playwright 스펙은 `web-client/tests/e2e/participation.spec.ts`에 위치한다.
- 공통 렌더 헬퍼(`renderWithProviders`)와 viewport 제어 유틸은 `src/tests/testUtils.tsx`를 재사용한다.

## 5. 단위 테스트 시나리오
| ID | 대상 | 시나리오 | 검증 포인트 |
| --- | --- | --- | --- |
| UT-01 | ParticipationAppBar | 데스크톱/모바일 액션 렌더 | 앱 바 타이틀, 도움말/새로고침/재시도 버튼의 `aria-label`과 모바일 오버플로 메뉴 노출 |
| UT-02 | ParticipantInfoCard | 닉네임/PIN 입력 검증 | 공백 입력 시 인라인 오류, 길이 제한 메시지, `focus()` 이동 및 `aria-live` 업데이트 |
| UT-03 | ParticipantInfoCard | LocalStorage 토글 | 토글 on/off 시 `storage.saveCredentials`/`clearCredentials` 호출 여부 |
| UT-04 | ParticipantInfoCard | PIN 불일치 상태 | `INVALID_PIN` 오류 모델 전달 시 에러 배지와 핀 필드 포커스 유지 |
| UT-05 | WeekNavigator | 주간 이동 | prev/next 클릭 및 ArrowLeft/Right 입력 시 `weekOffset` 변경, `aria-live="polite"` 텍스트 업데이트 |
| UT-06 | SlotGrid | 슬롯 토글 | Space/Enter로 슬롯 토글 시 `onToggleSlot` 호출, 비활성 슬롯은 `cursor: not-allowed` 유지 |
| UT-07 | SlotGrid | 응답률 배지 색상 | summary 응답률 80/55/30%에 대해 success/warning/error 톤 클래스 적용 |
| UT-08 | SummaryPanel | 선택 집계/경고 | 선택/미선택 카운트 표시, 기존 응답 덮어쓰기 경고 문구와 CTA 상태 변화 |
| UT-09 | ToastStack & InlineStatus | 오류/성공 토스트 | `aria-live` 영역에 success/error/warning 토스트 렌더, HTTP 코드 캡션 노출 |
| UT-10 | slotKey.ts & storage.ts | 포맷/저장 유틸 | `slotKey` 파싱/정렬 결과, 저장 토글 off 시 값 제거, 만료 없는 단순 저장 확인 |
| UT-11 | strings.ts | 카피 스냅샷 | 주요 키(`startParticipation`, `submitAvailability`, `nicknameTaken`, `invalidSlot` 등) 존재 및 기본 텍스트 검증 |

## 6. 훅 테스트 시나리오 (useParticipationFlow)
| ID | 시나리오 | 절차 | 예상 결과 |
| --- | --- | --- | --- |
| HK-01 | 초기 로딩 상태 | 훅 렌더 직후 상태 확인 | `status`=`loading`, `selectedSlots` 빈 배열, `summary` 비어 있음 |
| HK-02 | 참여자 생성 성공 | msw 200 응답(`participantId`, `responses`) | `selectedSlots`가 `responses`로 동기화, `hasPin`/`lastSubmittedAt` 설정 |
| HK-03 | 닉네임 중복 | msw 409 `NICKNAME_TAKEN` | 오류 코드가 `nicknameTaken`으로 매핑되고 SlotGrid 비활성 유지 |
| HK-04 | PIN 불일치 | msw 403 `INVALID_PIN` | 오류 코드가 `invalidPin`으로 매핑, PIN 입력 포커스 유지, 재시도 가능 |
| HK-05 | 슬롯 제출 성공 | `submitAvailability` 성공 응답 | `summary.slotSummaries` 반영, 성공 토스트 플래그 true, `selectedSlots` 유지 |
| HK-06 | 슬롯 검증 오류 | msw 400 `INVALID_SLOT` | 오류가 경고 상태로 설정되고 SlotGrid에 오류 배지 전달 |
| HK-07 | 404 약속 없음 | msw 404 `APPOINTMENT_NOT_FOUND` | 상태가 `notFound`로 전환, 이후 `onRetry` 호출 시 재호출 기록 증가 |
| HK-08 | 503/네트워크 오류 | msw 503 또는 fetch reject | 오류 코드 `temporaryFailure` 또는 `network`, 기존 선택 상태 보존, `retry` 1회 동작 |
| HK-09 | 로컬 저장/불러오기 | 초기 props에 저장값 주입 | `isPersistedLocally` true일 때 닉네임/PIN이 기본값으로 설정되고 제출 후 저장값 갱신 |

## 7. 페이지 통합 테스트 시나리오 (ParticipateAppointmentPage)
| ID | 시나리오 | 절차 | 예상 결과 |
| --- | --- | --- | --- |
| IT-01 | 초기 렌더 | 페이지 마운트 | 앱 바 스켈레톤, Participant 카드, SlotGrid 플레이스홀더, Summary 패널이 DOM에 존재 |
| IT-02 | 참여자 생성 성공 흐름 | 닉네임/PIN 입력 → 참여 시작 클릭 → 200 응답 | 성공 배지와 제출 시각 표시, SlotGrid 활성화, 토스트 `role="status"` 확인 |
| IT-03 | 닉네임 검증 실패 | 비어있는 닉네임 상태에서 제출 | 인라인 오류, 첫 오류 필드 포커스 이동, API 호출 없음 |
| IT-04 | 서버 중복 오류 | 409 응답 설정 | 오류 배지와 토스트 표시, SlotGrid 비활성 유지, 재시도 버튼 노출 |
| IT-05 | PIN 불일치 | 403 `INVALID_PIN` 응답 | PIN 필드 오류 메시지, 포커스 유지, 참여 상태 미변경 |
| IT-06 | 슬롯 선택/집계 | 템플릿 슬롯 3개 선택 후 제출 성공 | Summary 패널 카운트/타임스탬프 갱신, SlotGrid 응답률 배지 업데이트 |
| IT-07 | 슬롯 검증 오류 | 제출 시 400 `INVALID_SLOT` | 경고 토스트와 배지, 서버 집계 재조회, 기존 선택 유지 |
| IT-08 | 404 약속 없음 | 404 응답 설정 | 전체 화면 EmptyState와 홈 이동 링크 노출, `role="alert"` 없음 |
| IT-09 | 503/네트워크 오류 | 503 또는 fetch reject | 상단 오류 배너와 재시도 버튼, `refetch` 후 성공 응답으로 전환 |
| IT-10 | 반응형 전환 | viewport를 mobile/tablet/desktop으로 변경 | 앱 바 액션 노출 방식, SlotGrid 열 수/스크롤, Summary 패널 위치가 breakpoint 규칙과 일치 |
| IT-11 | LocalStorage 동기화 | "현재 기기 저장" on 상태에서 제출 후 새 렌더 | 닉네임/PIN이 자동 채워지고 저장 토글이 유지 |

## 8. Playwright E2E 시나리오
- **E2E-01 모바일 뷰**: 뷰포트 390x844. 닉네임 입력 → 참여 → 슬롯 선택/제출까지 스냅샷, 요일 카드 수평 스크롤과 Sticky 헤더 확인.
- **E2E-02 태블릿 뷰**: 900x720. WeekNavigator 버튼 텍스트/아이콘 노출, SlotGrid 4열 렌더와 Summary 패널 위치 스냅샷 검증.
- **E2E-03 데스크톱 뷰**: 1280x800. SlotGrid 7열, 앱 바 액션 버튼 풀 노출, Summary 패널 고정 위치를 스냅샷으로 확인.
- **E2E-04 오류 재시도**: 초기 503 모킹 → `재시도` 클릭 후 200 전환 → 토스트와 SlotGrid 데이터 업데이트 확인.
- **E2E-05 저장/복원 플로우**: 참여 후 페이지 새로고침 → LocalStorage에서 닉네임/PIN이 복원되고 슬롯 선택 상태가 서버 응답과 일치하는지 검증.

## 9. 비기능 테스트 및 커버리지
- `vitest --run --coverage` 실행 시 Line/Function 커버리지 85% 이상을 목표로 한다.
- 애니메이션/토스트 타이밍은 `vi.useFakeTimers()` 또는 `prefers-reduced-motion` mock으로 제어해 스냅샷 흔들림을 줄인다.
- msw 핸들러는 테스트 간 상태 누적을 방지하기 위해 `server.resetHandlers()`를 사용하고, `afterAll` 훅에서 `server.close()`를 호출한다.

## 10. 리포팅 및 CI 통합
- Vitest 커버리지 리포트는 `web-client/coverage`에 생성하고 CI 아티팩트로 업로드한다.
- Playwright 스냅샷/스크린샷은 실패 시 CI 아티팩트로 첨부해 UI 회귀 원인을 추적한다.
- PR 파이프라인에서 `npm run test:unit`(Vitest)과 `npm run test:e2e`(Playwright)을 분리 실행하고, 실패 시 로그/스크린샷을 함께 보고한다.

## 11. 관련 명세
- `agent/specs/meal-appointment-participation-frontend-implementation-spec.md`
- `agent/specs/meal-appointment-participation-uiux-spec.md`
- `agent/specs/meal-appointment-participation-user-spec.md`
- `agent/specs/meal-appointment-participation-backend-implementation-spec.md`
- `agent/specs/meal-appointment-architecture-spec.md`
