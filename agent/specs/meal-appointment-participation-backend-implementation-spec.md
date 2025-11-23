# 식사 약속 참여 백엔드 구현 명세

## 1. 목적과 범위
- 본 명세는 공유 링크로 접속한 사용자가 닉네임 기반으로 약속에 참여하고 가용 시간을 제출·수정하는 백엔드 구현 규칙을 정의한다.
- `meal-appointment-participation-user-spec.md`의 사용자 요구를 충족하기 위한 Express + Prisma 계층 구조를 전제로 하며, UI 렌더링은 범위에 포함되지 않는다.
- 약속 생성/조회는 참조만 하며, 확정·알림 등 부가 기능은 포함하지 않는다.

## 2. 엔드포인트 계약
### 2.1 참여 세션 생성/재사용
| 항목 | 값 |
| --- | --- |
| 메서드 | `POST` |
| 경로 | `/api/appointments/{appointmentId}/participants` |
| 인증 | 불필요 (공개) |
| 요청 본문 | `application/json` |
| 성공 응답 | `200 OK` (신규/재사용 모두 동일 코드) |

**요청 본문 스키마**
```json
{
  "nickname": "string",
  "pin": "string | undefined"
}
```

**성공 응답 스키마**
```json
{
  "participantId": "string",
  "nickname": "string",
  "hasPin": true,
  "submittedAt": "ISO-8601 timestamp | null",
  "responses": ["slotKey", "slotKey"]
}
```
- 닉네임이 새로 등록되면 참가자 레코드를 생성한다.
- 동일 닉네임이 이미 존재하면 PIN 검증 후 기존 참가자 정보를 반환한다. PIN이 없던 참가자에게 새 PIN을 설정하는 업서트는 허용하지 않는다.

### 2.2 가용성 제출/수정
| 항목 | 값 |
| --- | --- |
| 메서드 | `PUT` |
| 경로 | `/api/appointments/{appointmentId}/participants/{participantId}/responses` |
| 인증 | 닉네임 기반 공개 + 선택적 PIN 검증 |
| 요청 본문 | `application/json` |
| 성공 응답 | `200 OK` |

**요청 본문 스키마**
```json
{
  "nickname": "string",
  "pin": "string | undefined",
  "availableSlots": ["slotKey", "slotKey"]
}
```

**성공 응답 스키마**
```json
{
  "participantId": "string",
  "submittedAt": "ISO-8601 timestamp",
  "selected": ["slotKey", "slotKey"],
  "summary": {
    "participantCount": 3,
    "slotSummaries": [
      { "slotKey": "2024-03-05#DINNER", "availableCount": 2, "availabilityRatio": 0.67 }
    ]
  }
}
```
- `availableSlots`에 포함된 슬롯만 가능으로 저장하고 나머지는 불가능으로 취급한다.
- 응답에는 최신 집계 요약을 포함해 프런트엔드가 즉시 반영할 수 있도록 한다.

## 3. 입력 검증 및 미들웨어
- **닉네임:** 문자열 트리밍 후 길이 1~30자. 약속 내 중복 불가. `POST`/`PUT` 모두 동일 규칙을 사용한다.
- **PIN:** 미제공 시 `undefined`. 제공되면 4~12자이며 숫자·문자 조합 허용. 서버는 평문을 저장하지 않는다.
- **슬롯 키:** `availableSlots`는 중복 없는 배열이어야 하며, 템플릿에서 파생된 키(`{YYYY-MM-DD}#(LUNCH|DINNER|...)`)만 허용한다.
- 검증 실패 시 `400 VALIDATION_ERROR`와 필드별 메시지 배열을 반환한다. 존재하지 않는 약속은 `404 APPOINTMENT_NOT_FOUND`.

## 4. 서비스 계층 동작
### 4.1 `POST /participants`
1. `AppointmentRepository.findById`로 약속 유효성 확인 후 없으면 `404` 반환.
2. `ParticipantRepository.findByAppointmentAndNickname`으로 닉네임 존재 여부 확인.
3. 존재하지 않으면 PIN을 해시(예: bcrypt)하여 `participants` 테이블에 저장하고, 빈 응답 배열과 `submittedAt: null`을 반환한다.
4. 존재하면:
   - 저장된 PIN 해시가 있을 때 입력 PIN이 없거나 불일치하면 `403 INVALID_PIN`.
   - PIN이 일치하면 참가자 정보를 반환한다.
5. 모든 분기에서 Pino `info` 로그로 `participant.joined` 이벤트를 기록한다.

### 4.2 `PUT /responses`
1. 약속/참가자 식별자와 닉네임 일치 여부를 확인한다. 참가자 ID가 존재하지만 닉네임이 다르면 `403 PARTICIPANT_MISMATCH`.
2. 참가자가 PIN을 설정했다면 입력 PIN을 검증하고 불일치 시 `403 INVALID_PIN`.
3. `TimeSlotTemplateService`로 약속의 템플릿을 로드하고 유효한 슬롯 키 집합을 계산한다.
4. 입력 슬롯 배열을 필터링(중복 제거)하고 유효 키와 교집합만 남긴다. 교집합 결과가 원본과 다르면 `400 INVALID_SLOT`.
5. 단일 트랜잭션에서 기존 응답을 전부 삭제 후 새 응답을 일괄 삽입한다.
6. 업데이트된 응답을 기준으로 `AvailabilityAggregationService`를 호출해 요약을 계산하고 응답 payload로 반환한다.
7. 성공 시 `participant.responses.submitted` 로그를 `info`로 기록하고, 응답 집계 결과를 `debug` 레벨로 덧붙인다.

## 5. 데이터 저장 및 제약
- **participants** 테이블
  | 컬럼 | 타입 | 제약 | 설명 |
  | --- | --- | --- | --- |
  | `id` | `UUID` (PK) | NOT NULL | Prisma `@id @default(uuid())` |
  | `appointment_id` | `UUID` | FK | 약속 참조. `ON DELETE CASCADE` |
  | `nickname` | `VARCHAR(30)` | UNIQUE (`appointment_id`, `nickname`) | 소문자/대문자 구분, 트리밍 저장 |
  | `pin_hash` | `VARCHAR(255)` | NULLABLE | PIN 미사용 시 NULL |
  | `submitted_at` | `TIMESTAMP` | NULLABLE | 마지막 응답 제출 시각 |

- **slot_availabilities** 테이블
  | 컬럼 | 타입 | 제약 | 설명 |
  | --- | --- | --- | --- |
  | `id` | `UUID` (PK) | NOT NULL |
  | `participant_id` | `UUID` | FK | 참가자 참조. `ON DELETE CASCADE` |
  | `slot_key` | `VARCHAR(32)` | INDEX | 템플릿 기반 키 (`YYYY-MM-DD#MEAL`) |
  | `is_available` | `BOOLEAN` | NOT NULL | 항상 `TRUE`만 저장; 불가능 슬롯은 저장하지 않는다 |
  | `submitted_at` | `TIMESTAMP` | NOT NULL | 중복 INSERT 방지를 위한 최신 타임스탬프 |

- `submitted_at`은 `PUT /responses` 시점으로 업데이트한다.
- 슬롯 인스턴스를 별도 테이블로 만들지 않으며, `slot_key` 문자열만 저장한다.

## 6. 오류 및 상태 코드 매핑
| 코드 | HTTP | 상황 |
| --- | --- | --- |
| `APPOINTMENT_NOT_FOUND` | 404 | 약속 ID가 존재하지 않음 |
| `NICKNAME_TAKEN` | 409 | 동일 약속 내 닉네임이 다른 참가자에게 이미 사용됨 (PIN 미설정 포함) |
| `INVALID_PIN` | 403 | PIN 불일치 또는 PIN 미입력 후 검증 필요 시 |
| `PARTICIPANT_MISMATCH` | 403 | 경로의 `participantId`와 본문 `nickname` 불일치 |
| `INVALID_SLOT` | 400 | 템플릿에 없는 슬롯 키 제출 |
| `VALIDATION_ERROR` | 400 | 형식/길이/중복 규칙 위반 |
| `INTERNAL_ERROR` | 500 | 기타 서버 오류 |

## 7. 관측성 및 부가 요구사항
- 모든 검증 실패 케이스는 Pino `warn` 레벨로 기록하고, 사용자 입력 값은 마스킹하여 저장한다.
- `participant.joined`, `participant.responses.submitted` 이벤트에 대해 응답 시간(ms)과 삽입된 슬롯 개수를 메트릭으로 기록한다.
- 캐싱이 필요한 경우 템플릿 로딩 결과에 대해 5분 TTL 인메모리 캐시를 활용한다(아키텍처 명세와 동일한 전략 재사용).
- 네트워크 오류나 DB 장애로 실패 시 트랜잭션을 롤백하고 idempotency 보장을 하지 않는다. 클라이언트 재시도를 허용한다.
