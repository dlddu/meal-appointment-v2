# 식사 약속 조회 API 계약 브레인스토밍 명세

## 1. 목적과 범위
- 목적: `/api/appointments/{appointmentId}` 조회 API가 도메인 모델과 사용자 요구사항을 충족하도록 교환할 데이터 구조와 에러 규칙을 정의한다.
- 범위: 읽기 전용 조회 요청에 대한 계약에 한정하며, 응답 생성·수정·삭제, 인증, 캐싱 정책 세부 설정 등은 포함하지 않는다.
- 전제: 약속과 참여자 응답은 `meal-appointment-domain-spec.md`에서 정의한 개체를 따른다. 템플릿 기반 슬롯은 요청 시점에 동적으로 계산한다.

## 2. 엔드포인트 개요
- HTTP 메서드: `GET`
- 경로: `/api/appointments/{appointmentId}`
- 경로 변수: `appointmentId` (문자열, 약속을 식별하는 고유 ID)
- 요청 헤더: 기본 JSON 수신(`Accept: application/json`), 인증 헤더는 요구하지 않는다.

## 3. 성공 응답 구조
- 상태 코드: `200 OK`
- 바디 최상위 구조: `appointment`, `template`, `participants`, `aggregates` 필드를 포함하는 JSON 객체.

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
| `rules` | array of object | 템플릿 규칙 전체 데이터. 각 항목은 `ruleId`(임의 UUID), `dayPattern`(예: `WEEKDAY`, `WEEKEND`), `mealTypes` 배열을 포함한다. `mealTypes` 각 요소는 `mealType`(예: `LUNCH`, `DINNER`)과 템플릿이 정의한 원본 속성(예: `startTime`, `durationMinutes`)을 그대로 노출한다. 요약 라벨은 제공하지 않는다. |

### 3.3 `participants` 배열
- 약속에 응답한 닉네임별 세션 목록.
- 각 항목:
  - `participantId`: string, 내부 세션 식별자.
  - `nickname`: string, 사용자 입력 닉네임.
  - `submittedAt`: string (ISO-8601), 마지막 응답 제출 시각.
  - `responses`: array of object
    - 각 객체는 `slotKey`만을 포함하며, 사용자가 선택한 슬롯만 나열한다.

### 3.4 `aggregates` 객체
- 슬롯별 응답 요약 정보를 제공한다.
- 구조:
  - `slotSummaries`: array of object, 각 슬롯별 집계.
    - `slotKey`: string, 날짜(`YYYY-MM-DD`)와 규칙의 `mealType`을 `#`으로 결합한 안정적인 식별자(예: `2024-04-05#DINNER`).
    - `date`: string (`YYYY-MM-DD`), 슬롯 기준 날짜.
    - `mealType`: string, 템플릿 규칙이 정의한 식사 시간대.
    - `availableCount`: number, 가능한 것으로 표시한 참여자 수.
    - `availabilityRatio`: number, `availableCount`를 `aggregates.participantCount`로 나눈 0~1 범위 비율. 참여자가 없으면 `0`으로 반환한다.
  - `participantCount`: number, 응답을 제출한 전체 참여자 수.

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
- `slotKey`는 날짜와 템플릿 규칙의 `mealType`을 조합해 생성하며, 약속 수명 동안 안정적으로 유지된다.
- 응답에 닉네임 미등록 사용자 정보는 포함되지 않으며, `participants` 목록은 실제 응답 제출자만 노출한다.
- `availabilityRatio` 계산에 필요한 분모 정보는 `aggregates.participantCount` 하나만 사용하며 별도 응답 수 합계를 제공하지 않는다.
