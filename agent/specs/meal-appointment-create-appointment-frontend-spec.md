# 식사 약속 생성 프런트엔드 구현 명세

## 1. 목적과 범위
- 본 명세는 `meal-appointment-create-appointment-user-spec.md`와 `meal-appointment-create-appointment-uiux-spec.md`를 충족하는 React 기반 약속 생성 페이지 구현 지침을 제공한다.
- `web-client` 패키지의 초점은 단일 페이지 내에서 약속 생성, 공유 URL 표기, 오류 안내까지이며, 약속 상세/참여 흐름은 범위에 포함되지 않는다.
- UI 레이아웃과 디자인 토큰은 `/web-client/mockups/create-appointment.html`을 참조하되 Tailwind CSS 유틸리티와 커스텀 CSS 변수를 결합해 재현한다.

## 2. 페이지 책임과 라우팅 전략
- 진입 경로는 `/create`로 정의하고, `App.tsx`는 React Router의 `BrowserRouter`를 도입해 `/`를 `/create`로 리다이렉트한다.
- 새 페이지 컴포넌트 파일 구조:
  - `src/pages/CreateAppointmentPage.tsx`: 상위 컨테이너, 데이터 훅 주입, 결과 패널 토글.
  - `src/features/create-appointment/components/AppointmentForm.tsx`: 입력 폼과 제출 버튼.
  - `src/features/create-appointment/components/TemplateOptionCard.tsx`: 템플릿 선택 카드.
  - `src/features/create-appointment/components/CreateSuccessPanel.tsx`: 공유 URL 및 후속 액션.
  - `src/features/create-appointment/hooks/useCreateAppointment.ts`: API 연동 및 상태 훅.
  - `src/features/create-appointment/types.ts`: 요청/응답 타입 정의.
- 기존 `AvailabilityMatrix` 데모는 제거하고, 전체 앱 엔트리에서 `CreateAppointmentPage`만 노출한다.

## 3. 디자인 토큰과 스타일 적용
- `src/index.css`에서 다크 테마 설정을 제거하고 아래 토큰을 CSS 변수로 정의한다.
  | CSS 변수 | 값 | Tailwind 매핑 |
  | --- | --- | --- |
  | `--color-primary` | `#2A6F97` | `theme.extend.colors.primary` |
  | `--color-secondary` | `#F4A261` | `theme.extend.colors.secondary` |
  | `--color-surface` | `#FFFFFF` | `theme.extend.colors.surface` |
  | `--color-background` | `#F8FAFC` | `theme.extend.colors.background` |
  | `--color-border` | `#D0D7E2` | `theme.extend.colors.border` |
  | `--color-success` | `#2F9E44` | `theme.extend.colors.success` |
  | `--color-error` | `#D64545` | `theme.extend.colors.error` |
- `tailwind.config.ts`의 `theme.extend`에 색상, 그림자(`dropShadow`), 테두리 반경(`borderRadius.lg = '12px'`)을 추가해 디자인 토큰을 유틸리티 클래스로 재사용한다.
- 페이지 배경은 `bg-[linear-gradient(180deg,_rgba(42,111,151,0.12)_0%,_rgba(248,250,252,0.9)_40%,_#f8fafc_100%)]` Tailwind 임의 값을 사용해 목업과 동일한 그래디언트를 적용한다.
- 컴포넌트별 기본 클래스 조합을 명세한다.
  - 카드 래퍼: `w-full max-w-[960px] bg-surface rounded-[20px] shadow-[0_12px_24px_rgba(15,23,42,0.12)] px-12 py-10` (모바일에서 `px-6 py-7 rounded-[16px]`).
  - 입력: `w-full h-12 rounded-[12px] border border-border px-4 py-3 text-base focus:outline-none focus:border-primary focus:ring-4 focus:ring-[rgba(42,111,151,0.15)]`.
  - 기본 버튼: `h-[52px] bg-primary text-white rounded-[12px] font-semibold shadow-[0_8px_16px_rgba(42,111,151,0.22)] transition-transform disabled:opacity-60`.

## 4. 상태 관리 및 훅 설계
- 클라이언트 상태는 React `useState`와 `useReducer` 조합으로 관리하고, 서버 요청은 React Query `useMutation`으로 처리한다.
- `useCreateAppointment` 훅 책임:
  - `mutationFn`은 `fetch`를 사용해 `POST ${API_BASE_URL}/appointments` 요청을 보낸다.
  - `onSuccess` 시 성공 응답(`CreateAppointmentSuccess`)을 반환하고, 폼 값과 함께 `CreateAppointmentResult` 객체를 상태로 유지한다.
  - `onError`는 HTTP 상태별 에러 모델을 표준화한다(`ValidationErrorResponse`, `ServerErrorResponse`, `NetworkError`).
- API 기본 URL은 `App.tsx`에서 `globalThis.__API_BASE_URL__ ?? 'http://localhost:4000/api'` 값을 재사용한다.

## 5. 폼 입력 및 검증 규칙
- 폼 상태 인터페이스:
  ```ts
  type CreateAppointmentFormState = {
    title: string;
    summary: string;
    timeSlotTemplateId: string;
    touched: { title: boolean; summary: boolean; template: boolean };
  };
  ```
- 실시간 검증 로직:
  - `title`: `value.trim()` 기준 1~60자. 공백 입력 시 오류 메시지 "제목을 입력해주세요.".
  - `summary`: 0~200자. 초과 시 남은 글자 수를 표시.
  - `timeSlotTemplateId`: 미선택 시 오류 "템플릿을 선택해주세요.".
- 오류 메시지는 UI/UX 명세의 에러 컬러를 적용하고 `aria-live="polite"` 요소에 렌더링한다.
- 제출 시 클라이언트 검증 → 실패 항목에 `focus()` 호출. 성공 시 `useMutation.mutate` 실행.

## 6. 템플릿 선택 구현
- 초기 활성 템플릿 리스트는 상수 배열로 선언한다.
  ```ts
  const TEMPLATE_OPTIONS = [{
    id: 'default_weekly',
    title: '주간 기본 템플릿',
    description: '월~금, 11:30 - 13:30',
    badge: '기본 제공',
    disabled: false
  }];
  ```
- 잠금 상태 템플릿은 UI/UX 목업처럼 표시하되 클릭 시 선택되지 않고 "준비 중" 토스트를 띄운다.
- `TemplateOptionCard`는 키보드 조작을 지원하며 `role="radio"`/`aria-checked` 속성을 사용한다. 선택 시 `space` 또는 `enter`로 토글한다.

## 7. 제출, 로딩, 성공 처리 흐름
1. 사용자가 "약속 만들기" 클릭 → 버튼 disabled, 로딩 스피너(12px 원형)와 "생성 중..." 텍스트 표시.
2. 성공 응답 수신 →
   - 폼 입력은 그대로 유지하되, 결과 패널(`CreateSuccessPanel`)이 `height` 애니메이션으로 슬라이드 다운.
   - `shareUrl`은 상대 경로이므로 `new URL(shareUrl, window.location.origin).toString()`으로 절대 경로를 계산해 노출한다.
   - `navigator.clipboard.writeText()` 호출 후 토스트(`SuccessToast`)를 3초 동안 표시하며 `role="status"`와 `aria-live="assertive"` 속성을 부여한다. 브라우저 권한 실패 시 `document.execCommand('copy')` 폴백을 시도하고 실패하면 오류 배너 표시.
   - 성공 상태에서 입력을 수정하면 결과 패널을 접고 `setResult(null)` 처리.
3. 서버 또는 네트워크 오류 →
   - 상단 배너(에러 컬러)로 요약 메시지를 표시.
   - 유효성 오류(`400`)는 응답의 `errors` 배열을 필드 매핑하여 각 입력 하단에 표시.
   - `503/500`은 공통 메시지 "일시적인 문제로 약속을 생성할 수 없습니다. 잠시 후 다시 시도하세요.".
   - 네트워크 오류 시 "다시 시도" 보조 버튼을 표시하여 마지막 폼 값으로 `mutate` 재호출.

## 8. 접근성 및 반응형 규칙
- `main` 요소를 기준으로 landmark 구조를 만들고, 히어로 영역/폼/결과/푸터를 `section`으로 구분하고 `aria-labelledby` 연결.
- 포커스 스타일: Tailwind `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`를 공통 버튼 및 카드에 적용.
- 모바일(`max-width: 768px`)에서는 `gap-6`, `px-4`, 아이콘 크기 56px로 축소하며, 공유 URL 카드는 세로 스택으로 재배치한다.
- URL 텍스트는 `break-all` 대신 `line-clamp-2` Tailwind 플러그인 없이 `max-h`/`overflow-hidden`+`text-ellipsis`로 두 줄 제한을 구현한다.

## 9. 국제화 및 카피 관리
- 모든 고정 텍스트는 한국어로 작성하고 `src/features/create-appointment/strings.ts`에 상수로 선언한다.
- 추후 다국어 확장을 고려해 `strings.ts`에서 export한 객체를 통해 UI 컴포넌트가 문구를 주입받도록 한다.

## 10. 단위 및 통합 테스트 요구사항
- `src/tests/create-appointment/CreateAppointmentPage.test.tsx`에 Vitest + Testing Library 기반 테스트 추가.
  - 초기 렌더에서 필드, 버튼, 힌트 텍스트가 표시되는지 검증.
  - 제목 미입력 상태로 제출 시 오류 메시지와 포커스 이동 확인.
  - 성공 목킹(`msw` 없이 fetch mock) 후 결과 패널에 절대 URL과 복사 버튼이 노출되는지 확인.
  - 서버 400 응답 시 필드별 오류 표시, 500 응답 시 배너 메시지 노출을 검증.
  - 클립보드 API가 호출되는지 spy로 확인.
- React Query `QueryClient`는 테스트에서 `QueryClientProvider`로 감싸고, 각 테스트 후 `queryClient.clear()` 수행.

## 11. 관련 문서 연계
- `meal-appointment-create-appointment-user-spec.md`: 입력 검증, 성공/실패 피드백 규칙을 준수한다.
- `meal-appointment-create-appointment-uiux-spec.md`: 레이아웃, 토큰, 상호작용 패턴을 일관되게 구현한다.
- `meal-appointment-architecture-spec.md`: React + Tailwind + React Query 스택과 API 상호작용 규칙을 따른다.
- `/web-client/mockups/create-appointment.html`: 시각적 레퍼런스. 픽셀 값이 명시되지 않은 부분은 mockup 스타일을 기준으로 Tailwind 유틸리티를 선정한다.
