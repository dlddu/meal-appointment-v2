# 식사 약속 조회 API 계약 명세

## 1. 목적 및 범위
- 본 문서는 공개 조회용 `GET /api/appointments/{appointmentId}` 엔드포인트의 응답 계약과 오류 동작을 정의한다.
- 약속 생성, 응답 작성/수정, 관리자 편집 로직은 본 명세 범위에 포함되지 않는다.
- 도메인 모델은 `meal-appointment-domain-spec.md`와 동일하게 시간 슬롯 템플릿 기반으로 약속을 해석한다.

## 2. 엔드포인트 개요
| 항목 | 값 |
| --- | --- |
| 메서드 | `GET` |
| 경로 | `/api/appointments/{appointmentId}` |
| 인증 | 불필요 (공개 조회) |
| 요청 본문 | 없음 |
| 응답 콘텐츠 유형 | `application/json` |

## 3. 요청 사양
### 3.1 경로 변수
| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `appointmentId` | string | 예 | 생성 시 부여된 약속 식별자. 대소문자 구분 문자열이며 추가 검증 규칙은 도메인 명세를 따른다. |

### 3.2 쿼리 파라미터
- 본 엔드포인트는 추가 쿼리 파라미터를 지원하지 않는다. `timezone` 등 옵션 파라미터를 전달해도 무시되며 오류를 발생시키지 않는다.

### 3.3 요청 헤더
- `Accept: application/json` 을 권장한다.
- 인증·세션 쿠키가 필요하지 않으며, 전달되더라도 무시한다.

## 4. 성공 응답 사양 (`200 OK`)
### 4.1 최상위 구조
- 응답 본문은 아래 네 개의 최상위 속성만 포함한다.
  - `appointment`
  - `template`
  - `participants`
  - `aggregates`
- `slots`, `metadata`, `refreshedAt` 등 추가 객체는 반환하지 않는다.

```json
{
  "appointment": { "id": "apt_123", "title": "3월 팀 저녁", "summary": "주간 점검 후 식사", "createdAt": "2024-03-01T10:00:00Z", "updatedAt": "2024-03-02T09:00:00Z", "timeSlotTemplateId": "tmpl_weekly" },
  "template": {
    "id": "tmpl_weekly",
    "name": "주간 기본 템플릿",
    "description": "평일 저녁 1회, 주말 점심/저녁 2회",
    "rules": [
      { "dayPattern": "WEEKDAY", "mealTypes": ["DINNER"] },
      { "dayPattern": "WEEKEND", "mealTypes": ["LUNCH", "DINNER"] }
    ]
  },
  "participants": [
    {
      "participantId": "part_001",
      "nickname": "민수",
      "submittedAt": "2024-03-02T10:30:00Z",
      "responses": ["2024-03-05#DINNER", "2024-03-09#LUNCH"]
    }
  ],
  "aggregates": {
    "participantCount": 3,
    "slotSummaries": [
      { "slotKey": "2024-03-05#DINNER", "date": "2024-03-05", "mealType": "DINNER", "availableCount": 2, "availabilityRatio": 0.67 }
    ]
  }
}
```

### 4.2 `appointment` 객체
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | 약속 고유 식별자. |
| `title` | string | 약속 제목. |
| `summary` | string | 약속 요약 설명. 빈 문자열을 허용한다. |
| `createdAt` | string (ISO-8601 UTC) | 약속 생성 시각. |
| `updatedAt` | string (ISO-8601 UTC) | 약속 정보 또는 템플릿 변경이 반영된 최신 시각. |
| `timeSlotTemplateId` | string | 약속이 참조하는 시간 슬롯 템플릿 식별자. |

### 4.3 `template` 객체
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | 템플릿 식별자. |
| `name` | string | 템플릿 명칭. |
| `description` | string | 템플릿 설명. 선택 슬롯 수 등의 가이드를 포함할 수 있다. |
| `rules` | array | 날짜 패턴과 제공 식사 시간대를 명시하는 규칙 목록. |

- 각 `rules` 항목은 다음 속성을 가진다.
  - `dayPattern` (string): 템플릿이 적용되는 요일 패턴. 예: `WEEKDAY`, `WEEKEND`, `2024-03-09` 등 도메인 규칙이 허용하는 표현.
  - `mealTypes` (string[]) : 패턴에 해당하는 날짜에 제공되는 식사 구분 목록. 예: `DINNER`, `LUNCH`.
- 규칙 요약용 라벨(`label`)이나 규칙 고유 식별자(`ruleId`)는 노출하지 않는다.
- 규칙 배열은 템플릿 설계 순서를 유지하며, 클라이언트는 해당 규칙과 조회 범위(date range)를 조합하여 슬롯 키를 계산한다.

### 4.4 `participants` 배열
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `participantId` | string | 닉네임 세션을 대표하는 내부 식별자. 고정된 길이의 난수 문자열을 권장한다. |
| `nickname` | string | 사용자가 입력한 닉네임. 고유성은 약속 단위로 보장된다. |
| `submittedAt` | string (ISO-8601 UTC) | 해당 사용자가 마지막으로 응답을 제출한 시각. |
| `responses` | string[] | 사용자가 "가능"으로 선택한 `slotKey` 목록. |

- `responses`에는 선택한 슬롯만 포함되며, 선택하지 않은 슬롯이나 가용성 불리언(`isAvailable`)은 포함하지 않는다.
- `responses`가 빈 배열인 경우 사용자는 아직 가능한 슬롯을 선택하지 않은 상태로 해석한다.
- 닉네임 미등록 사용자나 초안 상태 사용자는 리스트에 포함되지 않는다.
- 참여자 정보는 닉네임 외 개인정보(이메일, 전화번호 등)를 포함하지 않는다.

### 4.5 `aggregates` 객체
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `participantCount` | number | 응답을 제출한 고유 참여자 수. `participants.length`와 동일해야 한다. |
| `slotSummaries` | array | 템플릿 규칙과 조회 기간으로 생성된 각 슬롯의 집계 정보. |

- 각 `slotSummaries` 항목은 다음 속성을 가진다.
  - `slotKey` (string): `YYYY-MM-DD#MEALTYPE` 형식으로 생성된 슬롯 식별자.
  - `date` (string): `YYYY-MM-DD` 형식의 현지 날짜. 템플릿 계산 시 기준 시간대를 따른다.
  - `mealType` (string): `DINNER`, `LUNCH` 등 템플릿에서 파생된 식사 구분.
  - `availableCount` (number): 해당 슬롯을 `responses`에 포함한 참여자 수.
  - `availabilityRatio` (number): `availableCount / participantCount` 계산 결과. 참여자가 없을 경우 `0`으로 설정한다.
- `slotSummaries`는 템플릿에서 파생 가능한 모든 슬롯을 포함하며, 선택 인원이 0인 슬롯도 누락하지 않는다.
- `totalResponses` 등 추가 필드는 포함하지 않는다.

### 4.6 `slotKey` 생성 규칙
- `slotKey`는 날짜와 식사 구분을 결합한 안정적 식별자다.
- 포맷: `YYYY-MM-DD#MEALTYPE` (예: `2024-03-05#DINNER`).
- 날짜는 템플릿 계산 시점의 기본 시간대(UTC 또는 시스템 기본값)를 사용하되, 응답 본문에는 시간대 정보 대신 날짜만 노출한다.
- 동일한 `slotKey`는 `participants.responses`와 `aggregates.slotSummaries`에서 동일하게 사용된다.

## 5. 오류 응답 사양
| HTTP 상태 | `error.code` | 설명 |
| --- | --- | --- |
| `404 Not Found` | `APPOINTMENT_NOT_FOUND` | `appointmentId`에 해당하는 약속이 존재하지 않음. |
| `503 Service Unavailable` | `SERVICE_UNAVAILABLE` | 템플릿 로딩 실패 등 일시적 서버 오류. 재시도 가능. |
| `500 Internal Server Error` | `INTERNAL_ERROR` | 처리되지 않은 서버 오류. |

- 모든 오류 응답은 아래 구조를 따른다.

```json
{
  "error": {
    "code": "APPOINTMENT_NOT_FOUND",
    "message": "약속을 찾을 수 없습니다."
  }
}
```

- `message`는 사용자 친화적인 한국어 문구를 권장하되, 상황에 맞게 영어 메시지를 사용할 수도 있다.

## 6. 보안 및 개인정보 고려 사항
- 엔드포인트는 공유 링크만으로 접근 가능한 공개 범위다. 서버는 별도의 세션 토큰이나 인증 쿠키를 요구하지 않는다.
- 응답 본문은 닉네임 외의 민감 정보를 노출하지 않는다.
- 서버는 응답 생성 시 선택적 PIN, 연락처, 기타 개인 식별자 정보를 포함하지 않는다.

## 7. 캐싱 및 동기화
- 서버는 `refreshedAt` 또는 기타 새로고침 메타데이터를 반환하지 않는다.
- 클라이언트는 필요 시 전체 엔드포인트를 재호출하여 최신 데이터를 가져온다.
- 일시적 장애 시 클라이언트는 `503` 응답을 감지하고 재시도 전략을 구현한다.
