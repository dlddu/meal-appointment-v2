# 식사 약속 조회 프런트엔드 테스트 명세

## 1. 목적과 범위
- 본 명세는 `meal-appointment-view-appointment-frontend-spec.md`와 `meal-appointment-architecture-spec.md`에서 정의한 약속 조회 화면을 검증하기 위한 프런트엔드 자동화 테스트 전략을 규정한다.
- 검증 대상은 `web-client` 워크스페이스의 `/appointments/:appointmentId` 경로와 관련된 페이지, React Query 훅, 파생 데이터 유틸, 접근성 피드백, 반응형 레이아웃이다.
- 백엔드 비즈니스 로직 자체는 범위에 포함되지 않으며, 프런트엔드가 계약에 맞춰 API 응답을 렌더링하고 오류·빈 상태를 처리하는지에 초점을 둔다.

## 2. 테스트 환경 전제
- 패키지 매니저: `npm`(Node.js 20 이상). 최초 실행 전 `npm install` 수행.
- 테스트 러너: Vitest. DOM 환경은 `jsdom`으로 설정하고 React Testing Library 및 user-event를 기본 유틸로 사용한다.
- 네트워크 계층은 `msw`(Mock Service Worker)의 `setupServer`로 `/appointments/:id` 요청을 모킹한다.
- React Query는 테스트마다 신규 `QueryClient`를 생성하고 `afterEach` 훅에서 `queryClient.clear()`와 `cleanup()`을 호출한다.
- Playwright 기반 브라우저 E2E 테스트는 공유 링크 복사, 탭 전환, 반응형 전환과 같은 핵심 플로우를 스냅샷과 함께 검증한다.

## 3. 테스트 계층별 전략
### 3.1 단위 테스트 (Vitest + Testing Library)
- **대상**: 프레젠테이션 컴포넌트(`ViewAppointmentAppBar`, `AppointmentOverviewCard`, `SlotSummaryGrid`, `ParticipantTabs`, `StatusMessage`), 문자열 상수(`strings.ts`), 포맷터(`formatSlot`, `groupSlotSummaries`, `buildParticipantMatrix`).
- **목표**: 의존성 최소화된 UI/로직의 조건 분기, 접근성 속성, 키보드 인터랙션을 검증한다.
- **설정**: `vitest --run --config vite.config.ts --dom` 실행. 렌더링 헬퍼(`renderWithProviders`)로 Tailwind 클래스와 토큰이 DOM에 반영되었는지 확인한다.

### 3.2 훅/파생 데이터 테스트 (Vitest)
- **대상**: `useAppointmentQuery` 훅 및 내부 파생 데이터 맵/그룹핑 로직.
- **목표**: 쿼리 상태(`isLoading`, `isError`, `data`), 재시도 핸들러, 응답 파생 필드(`slotGroups`, `participantMatrix`)가 명세의 규칙을 따르는지 검증한다.
- **설정**: `renderHook` + `QueryClientProvider` 래퍼. `fetch`를 msw 핸들러로 모킹하여 HTTP 코드(200, 404, 503, 네트워크 오류)별 분기를 확인한다.

### 3.3 페이지 통합 테스트 (Vitest + Testing Library + msw)
- **대상**: `ViewAppointmentPage` 전체.
- **목표**: 초기 로딩 → 성공 렌더 → 오류/빈 상태 → 재시도 흐름을 사용자의 실제 인터랙션과 동일하게 시뮬레이션한다.
- **설정**: React Router `MemoryRouter`로 `/:appointmentId` 파라미터를 주입하고, msw로 `/appointments/:id` 응답을 상황별로 교체한다. `user-event`로 탭 전환, 버튼 클릭, 키보드 이동을 실행한다.

### 3.4 시각/반응형 회귀 (Playwright)
- **대상**: `/appointments/:id` 페이지의 `mobile`(≤767px), `tablet`(768–1023px), `desktop`(≥1024px) 레이아웃.
- **목표**: 앱 바 액션 노출 방식, 슬롯 카드 열 수, 탭 헤더 정렬, 테이블→카드 전환이 브레이크포인트 규칙에 맞는지 스냅샷으로 검증한다.
- **설정**: `npx playwright test --project=chromium --grep "view-appointment"` 시나리오를 추가하고, 스냅샷은 `__screenshots__/view-appointment`에 저장한다. 클립보드 권한은 `context.grantPermissions(['clipboard-read', 'clipboard-write'])`로 허용한다.

## 4. 테스트 디렉터리 구조
```
web-client/
└── src/
    ├── features/view-appointment/
    │   ├── __tests__/
    │   │   ├── ViewAppointmentAppBar.test.tsx
    │   │   ├── AppointmentOverviewCard.test.tsx
    │   │   ├── SlotSummaryGrid.test.tsx
    │   │   ├── ParticipantTabs.test.tsx
    │   │   ├── StatusMessage.test.tsx
    │   │   └── utils/formatters.test.ts
    │   ├── __mocks__/viewAppointmentHandlers.ts
    │   └── hooks/__tests__/useAppointmentQuery.test.ts
    └── tests/view-appointment/
        └── ViewAppointmentPage.test.tsx
```
- Playwright 스펙은 `web-client/tests/e2e/view-appointment.spec.ts`에 위치한다.
- 공통 렌더 헬퍼(`renderWithProviders`)와 viewport 제어 유틸은 `src/tests/testUtils.tsx`에 둔다.

## 5. 단위 테스트 시나리오
| ID | 대상 | 시나리오 | 검증 포인트 |
| --- | --- | --- | --- |
| UT-01 | ViewAppointmentAppBar | 데스크톱 액션 버튼 렌더 | `재시도`, `공유`, `응답 작성하기` 버튼 존재 및 `aria-label` 확인 |
| UT-02 | ViewAppointmentAppBar | 모바일 메뉴 토글 | `max-width:640px` 강제 후 메뉴 버튼 클릭 시 액션 항목이 리스트로 노출 |
| UT-03 | AppointmentOverviewCard | 날짜/시간 포맷 | `updatedAt`을 `ko-KR` 포맷으로 표시하고 템플릿 배지가 렌더 |
| UT-04 | SlotSummaryGrid | 응답률 색상 토큰 | 응답률 75/55/35% 케이스별 Primary/Warning/Error 클래스 적용 |
| UT-05 | SlotSummaryGrid | 빈 슬롯 처리 | `slotSummaries`가 비면 템플릿 재시도 안내 메시지와 `onRetry` 버튼 노출 |
| UT-06 | ParticipantTabs | 탭 키보드 이동 | ArrowLeft/Right로 포커스 이동, `role="tabpanel"` 전환 확인 |
| UT-07 | ParticipantTabs | 슬롯별 상세 맵 | `participantMatrix` 입력 시 슬롯 카드에 응답자 태그가 모두 표시 |
| UT-08 | StatusMessage | 로딩/오류/빈 상태 | 로딩 스켈레톤, `role="alert"` 오류 배너, 빈 상태 아이콘 각각 렌더 |
| UT-09 | strings.ts | 카피 스냅샷 | 주요 키(`retry`, `share`, `emptyParticipants` 등) 존재 및 기본 텍스트 검증 |
| UT-10 | formatSlot & groupSlotSummaries | 파생 필드 검증 | `slotKey` → 날짜/식사/요일 라벨 파싱, 날짜 그룹 정렬, 응답률 톤 계산 |

## 6. 훅 테스트 시나리오 (useAppointmentQuery)
| ID | 시나리오 | 절차 | 예상 결과 |
| --- | --- | --- | --- |
| HK-01 | 초기 로딩 상태 | 훅 렌더 직후 상태 확인 | `status`=`loading`, `slotGroups` 빈 배열, 스켈레톤 플래그 true |
| HK-02 | 성공 응답 | 200 응답에 `slotSummaries`/`participants` 포함 | 파생 데이터가 날짜별로 그룹화되고 `participantMatrix` 맵 생성 |
| HK-03 | 404 오류 | msw로 404 응답 | 오류 객체가 `notFound` 코드로 매핑, 화면에서 EmptyState 사용 가능 |
| HK-04 | 503/500 오류 | msw로 503 응답 | 오류 객체가 `temporaryFailure` 코드로 매핑, `onRetry` 전달 |
| HK-05 | 네트워크 실패 | fetch reject | `error.code`=`network`로 설정, `refetch` 재호출 시 fetch 호출 횟수 증가 |
| HK-06 | 재시도 동작 | `refetch` 호출 | queryKey 유지, `retry` 1회 제한 내에서 재호출 기록 확인 |

## 7. 페이지 통합 테스트 시나리오 (ViewAppointmentPage)
| ID | 시나리오 | 절차 | 예상 결과 |
| --- | --- | --- | --- |
| IT-01 | 초기 렌더 | 페이지 마운트 | 앱 바, 오버뷰 카드 스켈레톤, 슬롯 카드 플레이스홀더가 DOM에 존재 |
| IT-02 | 성공 데이터 렌더 | 200 응답 설정 | 슬롯 카드가 날짜 그룹/식사 배지/통계 배지를 포함해 렌더, 참여자 탭 2개 활성 |
| IT-03 | 참여자 없음 | `participants` 빈 배열 | 응답자 탭 상단에 "아직 응답이 없습니다" 배너 노출, 슬롯별 상세는 빈 상태 |
| IT-04 | 응답률 강조 | slotSummaries에 30/50/80% 포함 | 각각 Error/Warning/Primary 톤으로 배경/텍스트 적용 |
| IT-05 | 404 오류 처리 | 404 응답 설정 | 전체 화면 EmptyState와 `재시도` 버튼 노출, `role="alert"` 없음 |
| IT-06 | 503 오류 처리 | 503 응답 설정 | 상단 오류 배너와 `재시도` 버튼, 재시도 시 msw 호출 횟수 증가 |
| IT-07 | 네트워크 오류 처리 | fetch reject | 오류 배너에 네트워크 메시지, `refetch` 호출 후 성공 응답으로 전환 |
| IT-08 | 공유 링크 복사 | `공유` 버튼 클릭 | `navigator.clipboard.writeText` 호출, 성공 토스트 `aria-live="polite"` 확인 |
| IT-09 | 반응형 전환 | `window.resizeTo`로 mobile/tablet/desktop 전환 | 앱 바 액션 노출 방식, 슬롯 카드 열 수, 탭 헤더 정렬이 breakpoint 규칙과 일치 |
| IT-10 | 탭 전환 | 키보드/마우스로 탭 전환 | `role="tabpanel"` 내용이 전환되고 포커스가 선택 탭으로 이동 |

## 8. Playwright E2E 시나리오
- **E2E-01 모바일 뷰**: 뷰포트 390x844. 탭 헤더가 pill 리스트로 표시되고 슬롯 카드가 단일 컬럼으로 스냅샷과 일치하는지 확인.
- **E2E-02 태블릿 뷰**: 900x720. 슬롯 카드 2열, 앱 바 액션 텍스트 축약 여부를 스냅샷으로 검증.
- **E2E-03 데스크톱 뷰**: 1280x800. 슬롯 카드 3열, 테이블 헤더 sticky 여부와 탭 좌우 정렬을 확인.
- **E2E-04 공유 플로우**: 페이지 로드 후 공유 버튼 클릭 → 클립보드 권한 허용 → 토스트 메시지와 클립보드 내용 확인.
- **E2E-05 오류 재시도**: 초기 503 응답 → `재시도` 클릭 후 200 응답으로 전환되는지 네트워크 요청 기록으로 검증.

## 9. 비기능 테스트 및 커버리지
- `vitest --run --coverage` 실행 시 Line/Function 커버리지 85% 이상을 목표로 한다.
- 애니메이션/토스트 타이밍은 `vi.useFakeTimers()` 또는 `prefers-reduced-motion` mock으로 제어해 스냅샷 불안을 최소화한다.
- msw 핸들러는 테스트 간 상태가 누적되지 않도록 `server.resetHandlers()`와 `afterAll server.close()`를 사용한다.

## 10. 리포팅 및 CI 통합
- Vitest 커버리지 리포트는 `web-client/coverage`에 생성하고 CI 아티팩트로 업로드한다.
- Playwright 스냅샷/스크린샷은 실패 시 CI 아티팩트로 첨부해 UI 회귀 원인을 파악한다.
- PR 파이프라인에서 `npm run test:unit`(Vitest)과 `npm run test:e2e`(Playwright)을 실행하고, 실패 시 로그/스크린샷을 함께 보고한다.

## 11. 관련 명세
- `agent/specs/meal-appointment-view-appointment-frontend-spec.md`
- `agent/specs/meal-appointment-view-appointment-uiux-spec.md`
- `agent/specs/meal-appointment-view-appointment-user-spec.md`
- `agent/specs/meal-appointment-view-appointment-backend-spec.md`
- `agent/specs/meal-appointment-architecture-spec.md`
