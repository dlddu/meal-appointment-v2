# 식사 약속 조회 API 계약 브레인스토밍 명세

## 1. 목적과 범위
- 목적: 공유 링크로 접근하는 사용자가 식사 약속 조회 화면에서 필요한 모든 데이터를 단일 API 계약으로 가져오도록, 요청/응답 구조와 데이터 항목을 정의한다.
- 범위: 약속 기본 정보, 템플릿 기반 슬롯 요약, 응답자 목록을 포함한 읽기 전용 조회 API에 한정되며, 응답 생성/수정이나 인증 API는 포함하지 않는다.

## 2. 인증 및 접근 정책
- 모든 요청은 공개 링크를 통해 이루어지며 토큰이나 세션 검증 없이 수행된다.
- 서버는 과도한 요청에 대비해 IP 기반 레이트 리밋을 적용할 수 있으나, 본 계약에는 별도 인증 헤더가 존재하지 않는다.

## 3. 엔드포인트 개요
| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `GET` | `/api/appointments/{appointmentId}/view` | 약속 조회 화면에 필요한 전체 데이터를 단일 페이로드로 반환한다. |

- `appointmentId`는 공유 링크에 노출되는 약속 식별자와 동일하다.
- 추가 필터링을 위한 쿼리 파라미터는 제공하지 않으며, 서버는 템플릿 규칙에 따라 모든 슬롯과 응답을 포함한다.

## 4. 요청 사양
- 헤더: `Accept: application/json` (기본값), 기타 사용자 정의 헤더 불필요.
- 경로 변수: `appointmentId` (문자열, 32자 이내 가정).
- 쿼리스트링: 없음.
- 요청 본문: 없음.

## 5. 응답 데이터 구조
### 5.1 최상위 구조
```
{
  "appointment": { ... },
  "timeSlotTemplate": { ... },
  "slotSummaries": [ ... ],
  "participants": [ ... ],
  "metadata": { ... }
}
```

### 5.2 `appointment` 객체
- `id` (`string`): 약속 식별자.
- `title` (`string`): 약속 제목.
- `summary` (`string`): 약속 요약 설명.
- `createdAt` (`string`, ISO 8601): 약속 생성 시각.
- `updatedAt` (`string`, ISO 8601): 마지막 응답이 접수된 시각 또는 약속 정보 변경 시각. 응답 기록이 없다면 `createdAt`과 동일.

### 5.3 `timeSlotTemplate` 객체
- `id` (`string`): 적용된 템플릿 식별자.
- `name` (`string`): 템플릿 이름.
- `description` (`string`): 템플릿 설명.
- `rules` (`array`): 슬롯 생성 규칙 목록.
  - 각 항목은 `pattern` (예: `WEEKDAY`, `WEEKEND`)과 `meals` 배열을 포함한다.
  - `meals` 항목은 `code`(`lunch`/`dinner`), `label`(표시용 문자열), `startTime`, `endTime`을 포함한다.
- `effectiveDateRange` (`object`, 선택): 슬롯 생성에 사용된 날짜 범위.
  - `start` (`string`, ISO 8601 날짜): 슬롯 계산 기준 시작일. 약속 생성일 또는 시스템 기본 범위.
  - `end` (`string`, ISO 8601 날짜): 조회에 포함된 마지막 날짜.

### 5.4 `slotSummaries` 배열
- 각 요소는 템플릿 규칙에서 파생된 개별 슬롯에 대한 요약을 담는다.
- 필드 정의:
  - `slotInstanceId` (`string`): `YYYY-MM-DD_{mealCode}` 형식의 파생 식별자.
  - `date` (`string`, ISO 8601 날짜): 슬롯 날짜.
  - `weekdayLabel` (`string`): 예: `화`, `토` 등 요일 레이블.
  - `mealCode` (`string`): `lunch` 또는 `dinner` 등 템플릿 정의 코드.
  - `mealLabel` (`string`): 사용자에게 노출할 식사 시간대 텍스트.
  - `availableCount` (`number`): `is_available=true` 응답 수.
  - `unavailableCount` (`number`): `is_available=false` 응답 수.
  - `noResponseCount` (`number`): 응답하지 않은 참여자 수.
  - `totalParticipants` (`number`): 해당 약속에 응답한 전체 참여자 수.
  - `availabilityRate` (`number`): `availableCount / max(totalParticipants, 1)` 계산 결과. 소수 둘째 자리까지 반올림.
  - `lastUpdatedAt` (`string`, ISO 8601, 선택): 마지막으로 이 슬롯에 대한 응답이 제출된 시각.

### 5.5 `participants` 배열
- 약속에 응답한 닉네임 세션 목록을 반환한다.
- 필드 정의:
  - `participantId` (`string`): 내부 식별자.
  - `nickname` (`string`): 응답 시 입력한 닉네임. 공개 정보로 취급.
  - `hasPin` (`boolean`): 세션에 PIN이 설정되어 있는지 여부. PIN 값 자체는 반환하지 않는다.
  - `responses` (`array`): 슬롯별 응답 목록.
    - 각 요소는 `slotInstanceId` (`string`), `isAvailable` (`boolean`), `submittedAt` (`string`, ISO 8601)을 포함한다.
  - `lastSubmittedAt` (`string`, ISO 8601): 사용자가 마지막으로 응답을 제출한 시각.

### 5.6 `metadata` 객체
- `fetchedAt` (`string`, ISO 8601): 서버가 응답을 생성한 시각.
- `supportsRefresh` (`boolean`): 클라이언트가 새로 고침 UI를 표시할지 여부.
- `notes` (`array`, 선택): 사용자에게 전달할 안내 메시지(예: "템플릿 규칙에 따라 슬롯이 자동 생성됩니다").

### 5.7 응답 예시
```
{
  "appointment": {
    "id": "apt_12345",
    "title": "팀 회식 시간 조율",
    "summary": "5월 둘째 주 저녁 가능한 시간 공유",
    "createdAt": "2024-05-01T09:30:00Z",
    "updatedAt": "2024-05-02T12:10:00Z"
  },
  "timeSlotTemplate": {
    "id": "tmpl_weekly_default",
    "name": "주간 기본 템플릿",
    "description": "평일 저녁 1회, 주말 점심/저녁 2회",
    "rules": [
      { "pattern": "WEEKDAY", "meals": [ { "code": "dinner", "label": "저녁", "startTime": "18:00", "endTime": "21:00" } ] },
      { "pattern": "WEEKEND", "meals": [
        { "code": "lunch", "label": "점심", "startTime": "11:30", "endTime": "13:30" },
        { "code": "dinner", "label": "저녁", "startTime": "17:30", "endTime": "20:00" }
      ] }
    ],
    "effectiveDateRange": { "start": "2024-05-06", "end": "2024-05-12" }
  },
  "slotSummaries": [
    {
      "slotInstanceId": "2024-05-07_dinner",
      "date": "2024-05-07",
      "weekdayLabel": "화",
      "mealCode": "dinner",
      "mealLabel": "저녁",
      "availableCount": 3,
      "unavailableCount": 1,
      "noResponseCount": 2,
      "totalParticipants": 6,
      "availabilityRate": 0.5,
      "lastUpdatedAt": "2024-05-02T12:10:00Z"
    }
  ],
  "participants": [
    {
      "participantId": "ptc_001",
      "nickname": "소라",
      "hasPin": true,
      "responses": [
        { "slotInstanceId": "2024-05-07_dinner", "isAvailable": true, "submittedAt": "2024-05-02T10:00:00Z" }
      ],
      "lastSubmittedAt": "2024-05-02T10:00:00Z"
    }
  ],
  "metadata": {
    "fetchedAt": "2024-05-02T12:10:15Z",
    "supportsRefresh": true,
    "notes": ["템플릿 규칙에 따라 슬롯이 자동 생성됩니다."]
  }
}
```

## 6. 오류 응답
| 상태 코드 | 조건 | 응답 예시 |
| --- | --- | --- |
| `404 Not Found` | 약속이 존재하지 않음 | `{ "error": "APPOINTMENT_NOT_FOUND", "message": "약속을 찾을 수 없습니다." }` |
| `503 Service Unavailable` | 슬롯 템플릿 계산 실패 등 일시적 오류 | `{ "error": "TEMPLATE_UNAVAILABLE", "message": "일시적인 문제로 약속 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요." }` |
| `500 Internal Server Error` | 예기치 않은 서버 오류 | `{ "error": "INTERNAL_ERROR", "message": "서버 오류가 발생했습니다." }` |

- 오류 응답에도 `fetchedAt`와 같은 메타데이터를 포함할 수 있으나 필수는 아니다.

## 7. 데이터 정합성 및 갱신 정책
- 서버는 `updatedAt`과 `slotSummaries[].lastUpdatedAt`을 사용해 클라이언트가 데이터 최신 여부를 판단하도록 돕는다.
- 응답 생성 시 서버는 모든 슬롯 집계를 실시간 계산하며, 별도 캐시를 사용하는 경우에도 조회 요청 시 최신 응답을 반영해야 한다.
- 참여자가 새로운 응답을 제출하면 `updatedAt`과 해당 슬롯의 카운트가 즉시 갱신되어야 한다.

## 8. 개인정보 및 보안 고려 사항
- 닉네임과 PIN 설정 여부만 반환하며, PIN 값 및 추가 개인 정보는 포함하지 않는다.
- 공개 API 특성상 응답에는 개인 연락처나 이메일을 포함하지 않는다.
- 서버는 과도한 데이터 노출을 방지하기 위해 불필요한 내부 식별자(예: DB 기본 키)를 숨기고, 외부 공유용 식별자만 제공한다.

## 9. 향후 확장 여지
- 필요 시 `include` 쿼리 파라미터로 응답자 상세/집계만 선택적으로 가져오는 기능을 추가할 수 있다.
- 템플릿이 다중 주기를 지원하도록 `effectiveDateRange` 대신 `periods` 배열을 도입할 수 있다.
- 대규모 응답자를 위한 페이지네이션이 필요해질 경우 `participants` 배열을 별도 엔드포인트로 분리할 수 있다.
