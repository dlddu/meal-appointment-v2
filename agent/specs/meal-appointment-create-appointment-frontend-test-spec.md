# 식사 약속 생성 프런트엔드 테스트 명세

## 1. 목적과 범위
- 본 명세는 `meal-appointment-create-appointment-frontend-spec.md`와 `meal-appointment-architecture-spec.md`에서 정의한 약속 생성 화면을 검증하기 위한 프런트엔드 자동화 테스트 전략을 규정한다.
- 검증 대상은 `web-client` 워크스페이스의 `/create` 경로와 관련된 페이지, 기능 컴포넌트, React Query 훅, 상태 관리 로직, 접근성 피드백이다.
- 백엔드 API 자체의 동작은 범위에 포함되지 않으며, 프런트엔드가 계약에 맞춰 요청/응답을 처리하는지에 초점을 둔다.

## 2. 테스트 환경 전제
- 패키지 매니저: `npm`(Node.js 20 이상). 최초 실행 전 `npm install` 수행.
- 테스트 러너: Vitest. DOM 환경은 `jsdom`으로 설정하고, React Testing Library 및 user-event를 공통 유틸로 사용한다.
- 네트워크 계층은 `msw`(Mock Service Worker)의 `setupServer`를 이용해 통합 테스트에서 Fetch 호출을 모킹한다.
- React Query는 테스트 마다 새로운 `QueryClient`를 생성하고, `afterEach` 훅에서 `queryClient.clear()`와 `cleanup()`을 호출한다.
- Playwright 기반 브라우저 E2E 테스트는 선택 사항이지만, 공유 링크 복사, 반응형 레이아웃과 같은 중요 플로우에 대해 스냅샷을 추가로 확보할 수 있다.

## 3. 테스트 계층별 전략
### 3.1 단위 테스트 (Vitest + Testing Library)
- **대상**: 프레젠테이션 컴포넌트(`TemplateOptionCard`, `CreateSuccessPanel` 등), 폼 상태 리듀서, 문자열 상수, 포맷터.
- **목표**: 의존성 없는 UI 및 로직의 조건 분기 검증. DOM 접근성 속성, 키보드 인터랙션, 렌더링 조건을 확인한다.
- **설정**: `vitest --run --config vite.config.ts --dom`를 사용하며, 각 테스트는 `render` 유틸을 통해 접근성 속성을 검증한다.

### 3.2 훅/상태 테스트 (Vitest)
- **대상**: `useCreateAppointment`, 폼 상태 관리 훅.
- **목표**: React Query `mutationFn` 동작, 성공/에러 핸들러, clipboard 폴백 로직을 모킹하여 분기 처리와 리턴 타입을 검증한다.
- **설정**: `@testing-library/react-hooks` 대체로 `renderHook` API를 사용하고, `QueryClientProvider` 래퍼를 제공한다.

### 3.3 컴포넌트 통합 테스트 (Vitest + Testing Library + msw)
- **대상**: `CreateAppointmentPage` 페이지 전체.
- **목표**: 사용자 입력 → 검증 메시지 → API 호출 → 성공/에러 UI 전환의 흐름을 엔드투엔드로 시뮬레이션한다.
- **설정**: `setupServer`로 `/appointments` 엔드포인트를 모킹하고, 실제 DOM 이벤트(user-event)로 폼을 조작한다.

### 3.4 시각/반응형 회귀 (Playwright, 선택)
- **대상**: `/create` 페이지 주요 breakpoint(`mobile`, `tablet`, `desktop`).
- **목표**: 템플릿 카드 정렬, 성공 패널 애니메이션, 에러 배너 위치가 레이아웃 명세를 준수하는지 확인한다.
- **설정**: `npx playwright test --project=chromium --grep "create-appointment"` 시나리오 추가. 스크린샷 및 스냅샷은 `__screenshots__/create-appointment`에 저장한다.

## 4. 테스트 디렉터리 구조
```
web-client/
└── src/
    ├── features/create-appointment/
    │   ├── __tests__/
    │   │   ├── TemplateOptionCard.test.tsx
    │   │   ├── CreateSuccessPanel.test.tsx
    │   │   ├── AppointmentFormReducer.test.ts
    │   │   └── useCreateAppointment.test.ts
    │   └── __mocks__/createAppointmentHandlers.ts
    └── tests/create-appointment/
        └── CreateAppointmentPage.test.tsx
```
- 선택적 Playwright 스펙은 `web-client/tests/e2e/create-appointment.spec.ts`로 둔다.
- 공통 렌더링 헬퍼(`renderWithProviders`)는 `src/tests/testUtils.tsx`에서 제공한다.

## 5. 단위 테스트 시나리오
| ID | 대상 | 시나리오 | 검증 포인트 |
| --- | --- | --- | --- |
| UT-01 | TemplateOptionCard | Enter/Space 키보드 토글 | `aria-checked` 토글, `onSelect` 호출 횟수 |
| UT-02 | TemplateOptionCard | 비활성 템플릿 클릭 | `disabled` 카드에서 토스트 호출(`showToast('준비 중')`) |
| UT-03 | CreateSuccessPanel | 공유 URL 표시 | 절대 URL 계산 결과, `Copy` 버튼 접근성 라벨 확인 |
| UT-04 | CreateSuccessPanel | 클립보드 실패 폴백 | `navigator.clipboard.writeText` reject → `document.execCommand('copy')` 호출 |
| UT-05 | AppointmentFormReducer | 입력 trim 처리 | `UPDATE_FIELD` 액션 후 상태의 `title`, `summary`가 `trim()` 적용 |
| UT-06 | AppointmentFormReducer | touched 플래그 | `SET_TOUCHED` 액션으로 특정 필드만 true 유지 |
| UT-07 | strings.ts | 카피 변경 시 감지 | 스냅샷으로 키 존재 여부와 기본 텍스트 검증 |
| UT-08 | useCreateAppointment | 성공 경로 | fetch mock 201 → result 상태에 `shareUrl`/`appointmentId` 반영 |
| UT-09 | useCreateAppointment | 400 에러 매핑 | 응답 `errors` 배열이 필드 맵으로 변환되는지 확인 |
| UT-10 | useCreateAppointment | 네트워크 오류 | fetch reject → `NetworkError` 반환, 재시도 핸들러 노출 |

## 6. 통합 테스트 시나리오 (CreateAppointmentPage)
| ID | 시나리오 | 절차 | 예상 결과 |
| --- | --- | --- | --- |
| IT-01 | 초기 렌더 | 페이지 렌더링 | 히어로 헤딩, 입력 3개, 템플릿 카드, 제출 버튼이 DOM에 존재 |
| IT-02 | 필수 입력 검증 | 비어있는 상태에서 제출 | 제목 오류 메시지, 템플릿 선택 오류, 첫 오류 입력에 포커스 이동 |
| IT-03 | 요약 글자수 제한 | 200자 초과 입력 | 남은 글자 수 음수 표시, 오류 메시지와 `aria-live` 업데이트 |
| IT-04 | 성공 응답 | 양식 입력 후 서버 201 반환 | 버튼 로딩 → 성공 패널 슬라이드, 절대 URL과 복사 버튼 표시, 기존 폼 값 유지 |
| IT-05 | 성공 후 수정 | 성공 상태에서 제목 수정 | 결과 패널 닫힘, 성공 상태 리셋, 버튼 텍스트가 기본으로 복귀 |
| IT-06 | 400 응답 처리 | 서버 400, `errors` 포함 | 각 필드 오류 노출, 상단 배너 미표시 |
| IT-07 | 500/503 응답 처리 | 서버 503 | 상단 에러 배너, 재시도 버튼 표시, 버튼 disabled 해제 |
| IT-08 | 클립보드 허용 | 성공 후 Copy 클릭 | `navigator.clipboard.writeText` 호출, 성공 토스트 `role="status"` 확인 |
| IT-09 | 클립보드 거부 | writeText reject | 폴백 실행, 실패 시 에러 배너 표시 |
| IT-10 | 템플릿 접근성 | 라디오 그룹 내 포커스 이동 | 키보드만으로 첫 카드 선택 가능, `aria-describedby` 연결 |

## 7. Playwright E2E 시나리오 (선택)
- **E2E-01 모바일 뷰**: 뷰포트 390x844. 입력/버튼 세로 스택, 성공 패널이 아래로 확장되는지 스냅샷으로 확인.
- **E2E-02 데스크톱 뷰**: 1280x720. 템플릿 카드 그리드 3열 유지, 그래디언트 배경 노출을 시각 회귀 테스트한다.
- **E2E-03 클립보드 시나리오**: Playwright의 `navigator.clipboard` 권한 허용 후 Copy 버튼 작동 여부 검증.

## 8. 비기능 테스트 고려사항
- 테스트 실행 시간은 5초 이하를 목표로 하며, `vitest --run --coverage` 시 커버리지 임계값(Line 85%, Function 85%)을 강제한다.
- 애니메이션이 있는 영역은 `prefers-reduced-motion`를 mock 하거나 `vitest.useFakeTimers()`로 타이밍을 제어한다.
- msw 핸들러는 테스트 간 상태가 누적되지 않도록 `server.resetHandlers()`를 사용하고, 예외 케이스는 각 테스트에서 명시적으로 정의한다.

## 9. 리포팅 및 CI 통합
- Vitest 커버리지 리포트는 `web-client/coverage`에 생성하고, CI에서 아티팩트로 업로드한다.
- Playwright 스냅샷/스크린샷은 실패 시 CI 아티팩트로 첨부해 UI 회귀 원인을 파악한다.
- PR 파이프라인에서 `npm run test:unit`(Vitest)과 `npm run test:e2e`(Playwright, 선택)을 분리 실행하여 실패 지점을 명확히 한다.

## 10. 관련 명세
- `agent/specs/meal-appointment-create-appointment-frontend-spec.md`
- `agent/specs/meal-appointment-architecture-spec.md`
- `agent/specs/meal-appointment-create-appointment-user-spec.md`
- `agent/specs/meal-appointment-create-appointment-uiux-spec.md`
- `agent/specs/meal-appointment-local-testing-spec.md`
