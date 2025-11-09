# 식사 약속 조회 API 계약 브레인스토밍 명세

## 1. 목적과 범위
- 목적: `/api/appointments/{appointmentId}` 조회 API가 도메인 모델과 사용자 요구사항을 충족하도록 교환할 데이터 구조와 에러 규칙을 정의한다.
- 범위: 읽기 전용 조회 요청에 대한 계약에 한정하며, 응답 생성·수정·삭제, 인증, 캐싱 정책 세부 설정 등은 포함하지 않는다.
- 전제: 약속과 참여자 응답은 `meal-appointment-domain-spec.md`에서 정의한 개체를 따른다. 템플릿 기반 슬롯은 요청 시점에 동적으로 계산한다.

## 2. 엔드포인트 개요
- HTTP 메서드: `GET`
- 경로: `/api/appointments/{appointmentId}`
- 경로 변수: `appointmentId` (문자열, 약속을 식별하는 고유 ID)
- 쿼리 파라미터: 선택적으로 `timezone`(IANA 타임존, 기본 UTC)을 허용하여 슬롯 날짜/시간 포맷에 반영한다.
- 요청 헤더: 기본 JSON 수신(`Accept: application/json`), 인증 헤더는 요구하지 않는다.

## 3. 성공 응답 구조
- 상태 코드: `200 OK`
- 바디 최상위 구조: `appointment`, `template`, `slots`, `participants`, `aggregates`, `metadata` 필드를 포함하는 JSON 객체.

### 3.1 `appointment` 객체
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | 약속 고유 식별자 (`appointmentId`). |
| `title` | string | 약속 제목. |
| `summary` | string | 약속 요약 설명. |
| `createdAt` | string (ISO-8601) | 약속 생성 시각. |
| `updatedAt` | string (ISO-8601) | 약속 마지막 변경 시각. |
| `timeSlotTemplateId` | string | 선택된 시간 슬롯 템플릿 식별자. |

### 3.2 `template` 객체
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | 템플릿 식별자 (`timeSlotTemplateId`). |
| `name` | string | 템플릿 이름. |
| `description` | string | 템플릿 설명. |
| `ruleSummaries` | array of object | 각 규칙에 대한 요약. 각 항목은 `dayPattern`(예: `WEEKDAY`), `mealType`(예: `DINNER`), `label`(사용자 표시 문자열)을 포함한다. |

### 3.3 `slots` 배열
- 템플릿 규칙과 약속 기간(현재는 템플릿 기본 기간)에 따라 동적으로 생성된 슬롯 목록.
- 각 슬롯 객체 필드:
  - `slotKey`: string, 날짜와 식사 시간대를 조합한 안정적인 식별자(예: `2024-04-05T19:00:00Z#DINNER`).
  - `start`: string (ISO-8601), 슬롯 시작 시각. `timezone` 쿼리 파라미터를 반영한다.
  - `end`: string (ISO-8601), 슬롯 종료 시각. 템플릿 규칙이 고정된 기간을 제공하지 않으면 `null` 허용.
  - `dateLabel`: string, 사용자에게 표시할 로컬 날짜 문자열.
  - `mealLabel`: string, 식사 시간대 설명(예: "평일 저녁").
  - `templateRuleRef`: object, `ruleId`(임의 UUID), `dayPattern`, `mealType`을 포함하여 어떤 규칙에서 파생되었는지 식별.

### 3.4 `participants` 배열
- 약속에 응답한 닉네임별 세션 목록.
- 각 항목:
  - `participantId`: string, 내부 세션 식별자.
  - `nickname`: string, 사용자 입력 닉네임.
  - `submittedAt`: string (ISO-8601), 마지막 응답 제출 시각.
  - `responses`: array of object
    - 각 객체는 `slotKey`, `isAvailable`(boolean) 값을 포함하며, 미응답 슬롯은 기본적으로 `false`로 저장됨을 명시.

### 3.5 `aggregates` 객체
- 슬롯별 응답 요약 정보를 제공한다.
- 구조:
  - `slotSummaries`: array of object, 각 슬롯별 집계.
    - `slotKey`: string, `slots` 배열과 동일한 식별자.
    - `totalResponses`: number, 해당 슬롯에 대해 응답을 제출한 참여자 수.
    - `availableCount`: number, 가능한 것으로 표시한 참여자 수.
    - `availabilityRatio`: number, 0~1 범위 비율(가능 인원/총 응답).
  - `participantCount`: number, 응답을 제출한 전체 참여자 수.

### 3.6 `metadata` 객체
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `refreshedAt` | string (ISO-8601) | 서버가 응답을 생성한 시각. |
| `timezone` | string | 응답에 사용된 타임존. |
| `readOnly` | boolean | 항상 `true`, 본 API가 조회 전용임을 명시. |
| `shareUrl` | string | 공유 가능한 약속 URL(`/appointments/{appointmentId}`). |

## 4. 에러 응답
- `404 Not Found`
  - 조건: `appointmentId`에 해당하는 약속이 없거나 접근 권한이 없음.
  - 본문: `{ "error": { "code": "APPOINTMENT_NOT_FOUND", "message": "약속을 찾을 수 없습니다." } }`
- `503 Service Unavailable`
  - 조건: 템플릿 로딩 실패 또는 집계 계산 시스템 오류 등 일시적인 서버 문제.
  - 본문: `{ "error": { "code": "SERVICE_UNAVAILABLE", "message": "일시적인 문제로 약속 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요." } }`
- `500 Internal Server Error`
  - 조건: 예기치 못한 서버 오류.
  - 본문: `{ "error": { "code": "INTERNAL_ERROR", "message": "예기치 못한 오류가 발생했습니다." } }`

## 5. 비고 및 고려사항
- 본 API는 인증 없이 접근 가능하므로 민감한 정보(이메일, 전화번호 등)는 반환하지 않는다.
- `slots` 배열과 `aggregates.slotSummaries`는 동일한 `slotKey` 집합을 공유해야 하며, 클라이언트는 키 매칭으로 요약과 상세 정보를 결합한다.
- 응답은 캐싱될 수 있으나, 최신 데이터를 요구하는 사용자 경험을 위해 `refreshedAt`을 활용한 수동 새로고침 안내를 제공한다.
- 향후 템플릿이 확장되더라도 `template.ruleSummaries`와 `slots.templateRuleRef` 구조를 통해 유연하게 규칙 정보를 제공한다.
- 응답에 닉네임 미등록 사용자 정보는 포함되지 않으며, `participants` 목록은 실제 응답 제출자만 노출한다.
