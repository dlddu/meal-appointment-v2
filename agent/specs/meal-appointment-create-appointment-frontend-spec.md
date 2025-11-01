# 식사 약속 생성 기능 프런트엔드 구현 명세

## 1. 목적 및 범위
- 본 명세는 `CreateAppointmentPage`를 비롯한 식사 약속 생성 흐름의 프런트엔드 구현 세부 사항을 정의한다.
- 사용자 명세(`meal-appointment-create-appointment-user-spec.md`)와 UI/UX 명세(`meal-appointment-create-appointment-uiux-spec.md`)의 요구사항을 React 18 + Vite + TypeScript + Tailwind CSS 스택에서 충족시키는 것을 목표로 한다.
- 약속 생성 이후의 참여자 관리, 삭제, 수정 기능은 범위에 포함하지 않는다.

## 2. 라우팅 및 페이지 구조
- 라우트 경로: `/create` (SPA 내부 라우터에서 선언). 기본 레이아웃(`AppShell`) 내 `main` 영역에 렌더링한다.
- 페이지는 3개의 상위 섹션으로 구성된다.
  1. `HeroSection`: 히어로 카드.
  2. `CreateAppointmentForm`: 입력 폼과 제출/결과 패널.
  3. `CreateAppointmentFooter`: 비로그인 안내 등 정보 푸터.
- 초기 진입 시 React Query의 캐시나 API 호출이 필요하지 않으므로 정적 데이터만으로 렌더링한다.

## 3. 컴포넌트 트리 및 책임
```
CreateAppointmentPage
├─ HeroSection
├─ CreateAppointmentForm
│  ├─ TitleField
│  ├─ DescriptionField
│  ├─ TemplateSelect
│  │  ├─ TemplateCard (라디오 역할)
│  ├─ GlobalErrorBanner
│  ├─ SubmitButton
│  └─ CreationResultPanel (제출 성공 시 확장)
│     ├─ ShareUrlCard
│     ├─ CopyLinkButton
│     └─ ViewDetailsButton
└─ CreateAppointmentFooter
```
- 각 하위 컴포넌트는 `props` 기반으로 상태를 주입받고, 폼 로직은 `CreateAppointmentForm` 상위 컴포넌트에서 관리한다.
- 재사용 가능한 공통 구성 요소(`Card`, `PrimaryButton`, `Toast`)가 이미 존재할 경우 해당 디자인 토큰을 반영하도록 스타일을 확장하고, 없을 경우 이 페이지에서만 사용하는 스타일 모듈(`create-appointment.module.css` 또는 Tailwind 조합)로 정의한다.

## 4. 상태 관리 및 훅
- 폼 상태는 `react-hook-form`(프로젝트 공통 폼 라이브러리가 없을 경우 신규 도입) 또는 React `useState`를 사용하되, 검증 규칙이 명확하므로 `react-hook-form` + `zod` 조합을 권장한다.
  - 필드 스키마: `{ title: string, description?: string, templateId: string }`.
  - 기본값: `title: ""`, `description: ""`, `templateId: "weekly-default"`.
- 서버 통신은 React Query `useMutation`을 사용한다.
  - 키: `['appointments', 'create']`.
  - 성공 콜백에서 공유 URL 상태(`shareUrl`)를 업데이트하고 결과 패널을 펼친다.
  - 오류 콜백에서 서버 검증 오류와 일반 오류를 분기하여 처리한다.
- UI 상태 변수:
  - `isSubmitting`: mutation 진행 여부 (제출 버튼 비활성화, 스피너 표시).
  - `shareUrl`: 성공적으로 반환된 URL 문자열. 존재 여부로 결과 패널 표시를 제어.
  - `globalError`: 서버/네트워크 오류 메시지 문자열. 값이 있으면 상단 배너 노출.
  - `toastState`: 링크 복사 성공 토스트 표시 여부.

## 5. 데이터 계약 및 API 연동
- 엔드포인트: `POST /appointments`.
- 요청 본문: `{ "title": string, "summary": string | null, "timeSlotTemplateId": string }`.
  - `description` 필드는 서버 스키마와 맞추기 위해 `summary` 키로 매핑한다 (아키텍처 명세의 DB 컬럼 `summary`). 빈 문자열일 경우 `null`로 전송.
- 응답 본문(성공): `{ "appointmentId": string, "shareUrl": string }`. `shareUrl`이 제공되지 않는다면 클라이언트에서 `${origin}/appointments/${appointmentId}`로 구성한다.
- 응답 본문(유효성 오류): `{ "fieldErrors": { [key: string]: string }, "message": string }` 형태를 가정. `fieldErrors`가 존재하면 해당 필드에 메시지를 바인딩하고, 없으면 `globalError`로 처리.
- 네트워크 실패 시 mutation이 throw하는 에러 메시지를 일반 오류 안내 문구(명세 7장)와 함께 배너에 노출하고, "다시 시도" 링크 클릭 시 `mutation.reset()` 후 재시도한다.

## 6. 입력 및 검증 규칙 구현
- 제목(`title`)
  - blur 시 트림(trim) 적용 후 빈 문자열이면 즉시 오류: "제목을 입력해주세요.".
  - 길이 1~60자 확인. 초과 시 "제목은 60자를 넘을 수 없습니다." 메시지.
- 설명(`description`)
  - 최대 200자. 초과 시 입력을 막지 않되 경고 문구 표시.
- 템플릿 선택(`templateId`)
  - 카드 클릭으로 설정. 현재 선택 가능한 옵션은 `weekly-default` 하나. 잠금 상태 템플릿은 disabled.
  - 접근성 위해 `role="radio"`, `aria-checked` 속성 사용.
- 제출 시 모든 클라이언트 검증 통과 후 mutation 실행.
- 서버 검증 오류는 동일한 메시지를 재사용한다.

## 7. UI/UX 및 스타일 가이드 적용
- Tailwind 테마 확장에 디자인 토큰을 매핑한다.
  - `primary` → `#2A6F97`, `secondary` → `#F4A261`, `surface` → `#FFFFFF`, `background` → `#F8FAFC`, `border` → `#D0D7E2`, `success` → `#2F9E44`, `error` → `#D64545`.
  - `rounded-xl` (12px) 커스텀으로 조정하거나 `rounded-[12px]` 사용.
- 레이아웃:
  - 최대 폭 960px 컨테이너를 중앙 정렬 (`mx-auto`, `max-w-[960px]`). 모바일에서는 `px-4`.
  - 폼 카드 내부 패딩은 데스크톱 `p-8`, 모바일 `p-5`. Tailwind `md:p-8` 등 사용.
- 제출 버튼은 `Primary Color` 배경, 높이 52px (`h-13` 커스텀 또는 `py-4` + `text-base`). 로딩 시 `Spinner` 컴포넌트 + "생성 중..." 텍스트.
- 결과 패널은 `Collapsible` 패턴 사용. `shareUrl`이 설정되면 `Transition`(Framer Motion 또는 CSS)으로 200ms ease-out 슬라이드.
- 복사 버튼은 Secondary 컬러 테두리, 클릭 시 focus ring 유지.
- 토스트는 화면 우상단 fixed, 3초 후 자동 닫힘. 여러 토스트를 허용하지 않고 상태 하나만 유지.

## 8. 사용자 상호작용 흐름
1. 페이지 렌더링 → 템플릿 제약 안내 표시.
2. 사용자가 제목/설명을 입력하고 템플릿 카드를 선택.
3. 제출 버튼 클릭 → 폼 disabled + 로더 표시.
4. 성공 응답 → `shareUrl` 설정, 폼 disabled 해제, 결과 패널 펼침.
5. "링크 복사" 클릭 → `navigator.clipboard.writeText(shareUrl)` 호출, 성공 시 토스트 표시. 실패 시 `globalError`에 "링크 복사에 실패했습니다" 메시지 추가.
6. 사용자가 필드를 수정하면 `shareUrl`을 `undefined`로 리셋하여 패널 접기. 단, 서버에서 받은 링크는 내부 상태에 유지하여 반복 렌더에서도 표시 가능.
7. "약속 세부 정보로 이동" 버튼 클릭 시 SPA 라우터를 사용해 `/appointments/{appointmentId}`로 이동.

## 9. 오류 처리 및 공지
- 서버 오류 배너: 명세 7장에서 정의한 문구를 사용하고 `aria-live="assertive"`.
- 필드 오류는 각 필드 하단에 `aria-live="polite"` 속성으로 표시.
- 네트워크 재시도 링크는 Mutation의 `onError`에서만 노출. 클릭 시 `mutate` 재호출.
- 중복 제출 방지: `isSubmitting` 동안 버튼 비활성화 및 `disabled` 속성 적용.

## 10. 접근성 및 국제화
- 모든 상호작용 요소에 키보드 포커스 스타일(`focus-visible:outline-primary`) 적용.
- 라벨과 입력을 `id`/`htmlFor`로 연결. 템플릿 카드에는 `aria-labelledby` 사용.
- 텍스트는 현재 한국어만 지원하나, 번역 리소스 파일(`i18n/ko.json`)에 키를 등록해 국제화 여지를 남긴다. 예: `createAppointment.form.titleLabel`.
- 토스트는 `role="status"` + `aria-live="assertive"`로 스크린 리더 알림.

## 11. 테스트 전략
- 유닛 테스트: `CreateAppointmentForm`에서 입력 검증과 mutation 호출 여부를 Vitest + React Testing Library로 검증.
  - 제목 61자 입력 시 오류 표시.
  - 성공 응답 모킹 후 결과 패널 표시 여부 확인.
- 통합 테스트: Playwright 시나리오에서
  1. 모든 필수 입력 후 제출 → 성공 토스트 확인.
  2. 서버 422 응답 모킹 시 필드 오류 표시 확인.
  3. 오프라인 모드(네트워크 차단)에서 재시도 링크 노출 확인.

## 12. 관련 명세 연계
- 사용자 입력 규칙은 `meal-appointment-create-appointment-user-spec.md`의 표 4-1 및 5장에서 정의한 제약을 준수한다.
- UI 요소와 레이아웃은 `meal-appointment-create-appointment-uiux-spec.md` 및 `/web-client/mockups/create-appointment.html`에 시각화된 구성을 기준으로 구현한다.
- API 계약은 `meal-appointment-architecture-spec.md` 및 `meal-appointment-create-appointment-backend-spec.md`의 `POST /appointments` 정의와 정합성을 유지한다.
