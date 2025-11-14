# 식사 약속 조회 백엔드 구현 명세

## 1. 목적과 범위
- 본 명세는 공개 조회 엔드포인트 `GET /api/appointments/{appointmentId}`의 백엔드 구현 방식을 정의한다.
- 사용자 및 UI/UX 요구사항은 각각 `meal-appointment-view-appointment-user-spec.md`, `meal-appointment-view-appointment-uiux-spec.md`를 따른다.
- 약속 생성, 응답 작성/수정, 관리자 도구는 범위 외로 간주한다.

## 2. 엔드포인트 및 라우팅 계층
- Express 라우터에서 `router.get('/api/appointments/:appointmentId', asyncHandler(controller.showAppointment))` 형태로 등록한다.
- 인증/세션 미들웨어를 적용하지 않는다. 단, 공통 `requestId` 로깅 미들웨어는 그대로 유지한다.
- `appointmentId` 경로 변수만 허용하며, 추가 쿼리 파라미터가 전달되더라도 무시한다.
- 컨트롤러는 성공 시 `200` 응답과 계약 명세의 4개 최상위 속성만 직렬화한다.

## 3. 입력 검증과 에러 매핑
- `appointmentId`는 다음 검증 규칙을 적용한다.
  - 문자열 타입 강제, 앞뒤 공백 제거.
  - 길이 8~48자, `[A-Za-z0-9_-]` 문자만 허용.
- 검증 실패 시 `400` 상태와 오류 코드 `VALIDATION_ERROR`를 반환하며, `error.details` 배열에 `[{ field: 'appointmentId', message }]` 형식을 따른다.
- 검증 이후 컨트롤러에서는 서비스 계층 예외를 HTTP 응답으로 변환한다.
  | 예외 | HTTP 상태 | 오류 코드 |
  | --- | --- | --- |
  | `AppointmentNotFoundError` | 404 | `APPOINTMENT_NOT_FOUND` |
  | `TemplateLoadingError` | 503 | `SERVICE_UNAVAILABLE` |
  | 기타 예외 | 500 | `INTERNAL_ERROR` |

## 4. 서비스 계층 책임 분리
- `AppointmentViewService.getPublicSnapshot(appointmentId: string): Promise<ViewSnapshot>` 메서드를 중심으로 구성한다.
- 주입 의존성
  - `AppointmentRepository`
  - `ParticipantRepository`
  - `SlotAvailabilityRepository`
  - `TimeSlotTemplateProvider`
  - `SlotAggregator`
  - `Logger`
- 서비스 흐름
  1. `AppointmentRepository.findById(appointmentId)` 호출. 존재하지 않으면 `AppointmentNotFoundError`를 던진다.
  2. `TimeSlotTemplateProvider.getById(timeSlotTemplateId)` 호출. 실패 시 `TemplateLoadingError`를 던진다.
  3. `ParticipantRepository.listByAppointment(appointmentId)` 호출로 닉네임·타임스탬프를 조회한다.
  4. `SlotAvailabilityRepository.listByAppointment(appointmentId)` 호출로 슬롯 응답을 조회한다.
  5. `SlotAggregator.buildSnapshot(appointment, template, participants, slotAvailabilities)`로 계약에 맞는 DTO를 생성한다.
  6. `Logger.info`로 `appointment.viewed` 이벤트를 기록하되, 개인정보를 포함하지 않는다.

## 5. 데이터베이스 및 ORM 접근
### 5.1 테이블 및 Prisma 모델
- `appointments`
  ```prisma
  model Appointment {
    id                 String   @id @db.Uuid
    title              String   @db.VarChar(60)
    summary            String   @default("") @db.VarChar(200)
    timeSlotTemplateId String   @map("time_slot_template_id") @db.VarChar(64)
    createdAt          DateTime @default(now()) @map("created_at") @db.Timestamptz
    updatedAt          DateTime @updatedAt @map("updated_at") @db.Timestamptz
    participants       Participant[]
  }
  ```
- `participants`
  ```prisma
  model Participant {
    id             String          @id @db.Uuid
    appointmentId  String          @map("appointment_id") @db.Uuid
    nickname       String          @db.VarChar(40)
    submittedAt    DateTime        @map("submitted_at") @db.Timestamptz
    responses      SlotAvailability[]
    @@index([appointmentId])
  }
  ```
- `slot_availabilities`
  ```prisma
  model SlotAvailability {
    id             String   @id @db.Uuid
    participantId  String   @map("participant_id") @db.Uuid
    appointmentId  String   @map("appointment_id") @db.Uuid
    slotDate       DateTime @map("slot_date") @db.Date
    mealType       String   @map("meal_type") @db.VarChar(16)
    isAvailable    Boolean  @map("is_available")
    @@index([appointmentId])
    @@index([participantId])
  }
  ```
- `SlotAvailabilityRepository`는 `isAvailable = true` 레코드만 조회한다. 불가능 응답은 저장하지 않는다.

### 5.2 쿼리 최적화 지침
- 참가자와 응답을 별도 쿼리로 가져오고 서비스 계층에서 매핑한다. 조인보다 캐싱된 템플릿 조합을 우선한다.
- `appointments` 조회는 단건이므로 Prisma `findUnique` 사용, 존재하지 않을 경우 `null` 반환을 검사한다.
- `participants`와 `slot_availabilities` 조회는 `appointmentId` 기준으로 필터링하며, 필요 시 페이징 없이 전량 반환한다.
- N+1 방지를 위해 `listByAppointment`는 정렬 조건(`submitted_at DESC`)을 포함한다.

## 6. 템플릿 로딩 전략
- `TimeSlotTemplateProvider`는 템플릿 ID를 키로 하는 읽기 전용 레지스트리를 제공한다.
  - 1차 구현: 애플리케이션 구동 시 JSON 설정을 로드하여 인메모리 캐시(1시간 TTL)로 유지.
  - 향후 DB 이전 시 인터페이스는 동일하게 유지하고, 프로바이더 구현만 교체한다.
- 템플릿 구조는 계약 명세의 `template` 객체와 동일하며, `rules` 배열은 정의된 순서를 그대로 유지한다.
- 로딩 실패 또는 비활성 템플릿 요청 시 `TemplateLoadingError`를 발생시킨다.

## 7. 슬롯 키 생성 및 집계 규칙
- `SlotAggregator`는 다음 단계를 따른다.
  1. 템플릿 규칙과 구성값 `APPOINTMENT_VIEW_DAYS`(기본 14일)를 조합하여 약속 생성일 이후 일정 범위의 모든 후보 슬롯을 계산한다.
  2. 각 슬롯에 대해 `slotKey = formatISODate(slotDate) + '#' + mealType.toUpperCase()`를 생성한다.
  3. `slot_availabilities`에서 `isAvailable = true`인 레코드를 `slotKey`로 그룹화하여 `availableCount`를 계산한다.
  4. `participantCount = participants.length`로 설정하고, 0일 경우 `availabilityRatio`는 0으로 고정한다. 0이 아닌 경우 소수 둘째 자리까지 반올림한다.
  5. `participants` 배열은 제출 시각 내림차순(가장 최근 응답 우선)으로 정렬하고, 각 참가자별 `responses`는 날짜 오름차순·동일 날짜 내 `mealType` 사전순으로 정렬한다.
  6. `aggregates.slotSummaries`는 날짜 오름차순, 동일 날짜 내 `mealType` 사전순으로 정렬한다.
- 슬롯 생성 범위는 UI 요구사항에 맞춰 한정하되, 향후 환경 변수 `APPOINTMENT_VIEW_DAYS`로 조정 가능하도록 상수화한다.
- 템플릿 규칙에 없는 슬롯은 집계에 포함하지 않는다.

## 8. 응답 직렬화 규칙
- 컨트롤러는 `ViewSnapshot` DTO를 그대로 JSON 직렬화하며, 추가 메타데이터(`refreshedAt`, `slots`)를 첨부하지 않는다.
- 날짜 및 시간은 ISO-8601 UTC 문자열로 변환한다. `slotDate`는 `YYYY-MM-DD` 포맷 문자열로 변환해 사용한다.
- `participants.responses`는 중복 제거된 `slotKey` 배열로, 문자열 비교 시 대소문자를 구분한다.

## 9. 오류 및 예외 처리
- 404/503/500 응답은 백엔드 계약 명세의 구조를 따른다.
- 모든 오류 응답에 `requestId` 헤더 값을 그대로 포함하여 추적성을 확보한다.
- 서비스 계층은 예외를 던지고, 컨트롤러에서 HTTP 상태를 매핑하되 메시지는 한국어 기본, 필요 시 영어 대체를 허용한다.

## 10. 로깅 및 관측성
- 성공 시 `Logger.info('appointment.viewed', { appointmentId, participantCount, templateId })` 패턴으로 기록한다.
- 404의 경우 `info` 레벨, 503/500의 경우 `error` 레벨로 기록하고, 예외 객체는 Pino `err` 필드에 전달한다.
- Prometheus 계측기
  - 카운터 `appointment_view_requests_total{status="success"|"error"}` 업데이트.
  - 히스토그램 `appointment_view_response_seconds`로 라우트 지연 시간을 측정.

## 11. 캐싱 및 성능 고려사항
- 서버는 HTTP 캐싱 헤더를 설정하지 않는다. 모든 요청은 실시간 데이터를 조회한다.
- `ParticipantRepository` 결과는 캐시하지 않는다. 인메모리 캐싱은 템플릿에만 적용한다.
- 향후 CDN 캐싱을 도입할 경우에도 응답 본문 구조 변경은 금지한다.

## 12. 테스트 전략
- **서비스 단위 테스트**
  - 존재하지 않는 약속 ID에 대해 `AppointmentNotFoundError` 발생 여부.
  - 템플릿 로딩 실패 시 503 매핑 여부.
  - 참가자 및 슬롯 응답 집계가 계약 구조와 정렬 규칙을 충족하는지 검증.
- **통합 테스트**
  - Prisma 테스트 DB를 사용해 약속/참가자/슬롯 데이터를 삽입하고 `GET /api/appointments/{id}`가 계약 명세 JSON을 반환하는지 확인.
  - 가용 응답이 없는 슬롯도 `slotSummaries`에 포함되는지 확인.
- **회귀 테스트**
  - 슬롯 생성 범위를 조정하는 구성 변경 시, 응답 구조가 사용자 명세 요구사항(개요/슬롯/요약/참여자)과 일치하는지 E2E로 검증.

## 13. 관련 명세
- `agent/specs/meal-appointment-view-appointment-user-spec.md`
- `agent/specs/meal-appointment-view-appointment-backend-spec.md`
- `agent/specs/meal-appointment-domain-spec.md`
- `agent/specs/meal-appointment-architecture-spec.md`
