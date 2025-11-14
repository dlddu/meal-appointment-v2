# 식사 약속 조회 백엔드 구현 명세

## 1. 목적과 범위
- 본 명세는 공개 조회용 `GET /api/appointments/{appointmentId}` 엔드포인트의 백엔드 구현 세부 사항을 정의한다.
- `agent/specs/meal-appointment-view-appointment-user-spec.md`가 서술한 사용자 경험을 만족시키고, `agent/specs/meal-appointment-view-appointment-backend-spec.md`가 정의한 응답 계약을 준수한다.
- 약속 생성, 응답 생성·수정, 인증 흐름은 범위에서 제외한다.

## 2. 계층 구조와 책임 분리
- **라우터 계층 (`AppointmentPublicRouter`)**: 경로 파라미터 검증과 Express 핸들러 바인딩만 수행한다.
- **컨트롤러/핸들러 (`ViewAppointmentController`)**: 서비스 계층을 호출하고, 성공/오류 응답을 계약에 맞게 직렬화한다.
- **어플리케이션 서비스 (`ViewAppointmentService`)**: 약속 로드, 템플릿 결합, 참여자/집계 계산, 정렬 로직을 조정한다.
- **도메인 유틸리티**:
  - `AvailabilityAggregator`: 참여자 응답 배열을 슬롯별 집계로 환산.
- **인프라스트럭처**:
  - `AppointmentRepository`, `ParticipantRepository`, `AvailabilityRepository`, `TemplateRepository` (Prisma 기반).
- 2차 캐시(`InMemoryTemplateCache`)는 템플릿 규칙 JSON을 5분 TTL로 유지하도록 구성한다.

## 3. HTTP 처리 규칙
- **라우팅**: `GET /api/appointments/:appointmentId([A-Za-z0-9_-]+)` 정규식을 사용해 공백, 특수문자 입력을 차단한다.
- **요청 검증**: `appointmentId`가 비어있을 경우 즉시 `404 APPOINTMENT_NOT_FOUND`를 반환한다(별도 400 응답 없음).
- **헤더 처리**: `If-None-Match`, `If-Modified-Since`는 지원하지 않고 무시한다. `Accept`가 JSON이 아닐 경우에도 JSON으로 응답한다.

## 4. 데이터 로딩 시퀀스
1. 서비스는 `AppointmentRepository.findById(appointmentId)`를 호출한다.
   - 존재하지 않으면 `AppointmentNotFoundError`를 던지고 컨트롤러에서 404로 매핑한다.
2. 약속이 존재하면 `TemplateResolver`가 템플릿 규칙을 확보한다.
   - 우선 캐시 조회(`templateCache.get(timeSlotTemplateId)`), 실패 시 `TemplateRepository.findById`로 로드하고 캐시에 저장한다.
   - 템플릿 레코드가 없으면 `TemplateUnavailableError`를 발생시키고 503으로 매핑한다.
   - 템플릿 규칙은 저장된 순서를 그대로 유지하며, 별도의 슬롯 생성 로직을 실행하지 않는다.
3. 병렬로 참여자와 응답 데이터를 조회한다.
   - `ParticipantRepository.listByAppointment(appointmentId)`는 `participantId`, `nickname`, `submittedAt`을 반환한다.
   - `AvailabilityRepository.listAvailability(appointmentId)`는 `{ participantId, slotKey }` 목록을 반환한다. `slotKey`는 `YYYY-MM-DD#MEALTYPE` 포맷으로 저장되어 있어야 한다.
   - 참여자/응답 조회는 단일 커넥션 내에서 수행하되 트랜잭션은 사용하지 않는다(읽기 전용).
4. 슬롯 키와 날짜/식사 정보는 템플릿에 저장된 데이터를 신뢰하며 추가 계산 없이 응답을 구성한다.

## 5. 응답 데이터 구성
- **참여자 매핑**: `participants` 배열을 생성할 때 각 참여자의 `responses`는 `AvailabilityRepository` 결과에서 같은 `participantId`를 가진 `slotKey`만 필터링하여 정렬(슬롯 목록 순서와 동일) 후 문자열 배열로 반환한다.
- **집계 계산**:
  - `AvailabilityAggregator`는 응답 데이터를 입력으로 받아 `slotKey`별 선택 횟수를 집계한다.
  - `participantCount = participants.length`.
  - 서비스는 템플릿 규칙의 슬롯 순서대로 `slotSummaries`를 구성하면서 `AvailabilityAggregator` 결과를 참조한다.
  - 각 슬롯에 대해 `availableCount`는 집계된 선택 횟수이며, 누락된 슬롯은 `0`으로 채운다.
  - `availabilityRatio`는 참여자가 0명일 때 `0`, 그렇지 않으면 `availableCount / participantCount`, 소수 둘째 자리까지 반올림(예: 0.67). 반올림은 UI와 일관성을 위해 `Math.round(ratio * 100) / 100`을 사용한다.
- **정렬 규칙**:
  - 슬롯 목록은 날짜 오름차순, 동일 날짜 내에서는 `mealType` 프리셋 순서(`BREAKFAST` → `LUNCH` → `DINNER`)를 따른다.
  - `participants.responses`는 슬롯 순서를 유지하여 클라이언트가 인덱스 기반 매핑이 가능하도록 한다.
- **필드 제한**: 컨트롤러는 추가 메타데이터(`refreshedAt`, `slotDetails` 등)를 포함하지 않으며 계약에 정의된 4개의 최상위 키만 직렬화한다.

## 6. 저장소 인터페이스 세부 사항
- `AppointmentRepository.findById(id: string)`
  - SELECT: `id, title, summary, time_slot_template_id, created_at, updated_at`.
  - 캐시 사용 없음.
- `TemplateRepository.findById(id: string)`
  - SELECT: `id, name, description, ruleset_json`.
  - `ruleset_json`은 Prisma `JsonValue`로 파싱해 템플릿 규칙 객체로 변환한다.
- `ParticipantRepository.listByAppointment(appointmentId: string)`
  - SELECT: `id, nickname, submitted_at`.
  - ORDER BY `submitted_at` ASC로 반환해 최초 응답자가 먼저 보이도록 한다.
- `AvailabilityRepository.listAvailability(appointmentId: string)`
  - SELECT: `participant_id, slot_key` FROM `slot_availability`.
  - 인덱스: `(appointment_id, slot_key)`를 사용하여 슬롯별 집계 쿼리 성능을 확보한다.

## 7. 도메인 로직 세부 규칙
- `AvailabilityAggregator`
  - 응답 데이터에서 등장한 `slotKey`를 해시맵(`Map<slotKey, number>`)으로 축약하여 선택 횟수를 계산한다.
  - 각 응답 레코드를 순회하며 대응 슬롯의 `availableCount`를 증가시킨다. 템플릿 정의에 존재하지 않는 `slotKey`가 관측되더라도 데이터 스토어를 신뢰하고 그대로 집계한다.
  - 서비스 계층이 템플릿 규칙 순서를 적용할 수 있도록 `availableCountBySlotKey` 맵과 총 응답 수(`totalSelections`)를 반환한다.

## 8. 오류 및 예외 매핑
| 예외 | HTTP 상태 | `error.code` | 메시지 규칙 |
| --- | --- | --- | --- |
| `AppointmentNotFoundError` | 404 | `APPOINTMENT_NOT_FOUND` | "약속을 찾을 수 없습니다." |
| `TemplateUnavailableError` (미존재) | 503 | `SERVICE_UNAVAILABLE` | "템플릿 정보를 불러올 수 없습니다. 잠시 후 다시 시도하세요." |
| `TemplateEvaluationError` (JSON 스키마 오류) | 503 | `SERVICE_UNAVAILABLE` | 템플릿 로딩 실패로 간주하고 동일한 메시지 사용 |
| 데이터베이스 커넥션 오류 | 503 | `SERVICE_UNAVAILABLE` | 재시도 안내 메시지 |
| 기타 처리되지 않은 오류 | 500 | `INTERNAL_ERROR` | 일반 메시지 반환, 상세 정보는 로그에만 남긴다 |

- 모든 오류 응답에는 인프라 계층에서 주입한 `requestId` 헤더 값을 그대로 포함한다.
- 로깅 시 `error.context`에 `appointmentId`와 현재 단계(`fetch-appointment`, `load-template`, `aggregate-availability`)를 추가한다.

## 9. 캐싱 및 성능 고려
- 템플릿 캐시는 5분 TTL로 구성한다.
- 동일 약속에 대한 반복 호출을 가속하기 위해 참여자/응답 데이터는 캐시하지 않는다. 사용자 명세가 최신 데이터 보장을 요구하므로 조회마다 DB에서 읽는다.
- 서비스는 최대 200명의 참여자, 슬롯 42개(2주 * 3식)까지 100ms 내 응답을 목표로 한다. 응답 리스트는 Node.js 힙 내에서 계산하며 스트리밍 응답은 사용하지 않는다.

## 10. 관측성과 모니터링
- **로깅**: Pino logger를 사용하여
  - 성공 시 `appointment.viewed` 이벤트를 `info` 수준으로 기록 (`appointmentId`, `participantCount`, `slotCount`, `durationMs`).
  - 캐시 미스 시 `debug` 수준으로 `template.cache.miss` 로그를 남긴다.
- **메트릭**:
  - `http_server_requests_total{route="GET /api/appointments/:appointmentId"}` 카운터를 증가.
  - `appointment_view_duration_ms` 히스토그램(라벨: `cacheHit=true|false`).
  - `template_cache_hit_ratio` 게이지는 캐시 모듈에서 주기적으로 업데이트한다.
- **트레이싱**: OpenTelemetry를 사용할 경우 `ViewAppointmentService` 호출 범위를 하나의 스팬으로 래핑하고, DB 쿼리 스팬을 자식으로 기록한다.

## 11. 테스트 전략
- **단위 테스트**
  - `AvailabilityAggregator`가 빈 응답, 중복 슬롯 키, 다중 응답 케이스를 올바르게 집계하는지 확인한다.
  - 컨트롤러가 `AppointmentNotFoundError`, `TemplateUnavailableError`를 올바른 HTTP 코드로 매핑하는지 확인한다.
- **통합 테스트**
  - Prisma 테스트 데이터베이스를 이용해 실제 테이블에서 약속, 템플릿, 참여자, 응답 데이터를 삽입 후 엔드포인트 호출 결과가 계약 구조와 일치하는지 검증한다.
  - 템플릿이 누락된 상태일 때 503을 반환하는지, 응답 본문이 오류 계약을 따르는지 확인한다.
  - 캐시 미스/히트 시나리오를 검증하여 동일 템플릿을 조회할 때 캐시가 재사용되는지 로깅 또는 메트릭을 통해 확인한다.
- **회귀 테스트**
  - 사용자 명세의 핵심 흐름(공유 링크 접근 → 약속 개요/슬롯/참여자 표시)을 보장하기 위해 백엔드-프런트엔드 계약 스냅샷 테스트를 유지한다.

## 12. 관련 명세
- `agent/specs/meal-appointment-view-appointment-backend-spec.md`
- `agent/specs/meal-appointment-view-appointment-user-spec.md`
- `agent/specs/meal-appointment-domain-spec.md`
- `agent/specs/meal-appointment-architecture-spec.md`
