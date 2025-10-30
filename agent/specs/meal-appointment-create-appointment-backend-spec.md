# 식사 약속 생성 백엔드 구현 명세

## 1. 목적과 범위
- 본 명세는 `POST /appointments` 엔드포인트를 중심으로 식사 약속 생성 기능의 서버 사이드 구현 세부 사항을 정의한다.
- Express 기반 API 서버, Prisma ORM, PostgreSQL 데이터베이스를 사용하는 `meal-appointment-architecture-spec.md`와 호환되도록 작성되었다.
- 사용자 여정, UI 흐름, 인프라 레벨의 CORS/레이트 리밋 정책은 범위에서 제외하며, 해당 내용은 사용자·UI 명세 및 운영 문서를 따른다.

## 2. 엔드포인트 계약
### 2.1 요청
- 메서드 및 경로: `POST /appointments`
- 인증: 로그인 없이 누구나 호출 가능
- 헤더: `Content-Type: application/json`
- 본문 스키마
  ```json
  {
    "title": "약속 제목",            // string, 필수, 앞뒤 공백 제거 후 1~60자
    "summary": "간단한 안내",        // string, 선택, 미제공 시 빈 문자열 처리, 길이 0~200자
    "timeSlotTemplateId": "default_weekly" // string, 필수, 활성 템플릿 식별자
  }
  ```
- 검증 규칙
  - `title`: `trim()` 이후 길이 1~60자, 초과/미만 시 검증 오류.
  - `summary`: 미제공 시 `""`로 대체하며, 존재한다면 0~200자 범위 확인.
  - `timeSlotTemplateId`: 활성 템플릿 목록(캐시 기반, §5 참조)에 존재해야 함.

### 2.2 성공 응답 (`201 Created`)
```json
{
  "appointmentId": "uuid",
  "shareUrl": "/appointments/{appointmentId}",
  "title": "정제된 제목",
  "summary": "저장된 설명",
  "timeSlotTemplateId": "default_weekly",
  "createdAt": "2024-03-01T12:00:00.000Z"
}
```
- `shareUrl`은 항상 상대 경로(`/appointments/{appointmentId}`)로 반환하며 `PUBLIC_BASE_URL` 등을 조합하지 않는다.
- `title`, `summary`, `timeSlotTemplateId`는 DB에 저장된 최종 값과 일치한다.

### 2.3 오류 응답
- 유효성 실패: `400 Bad Request`
  ```json
  {
    "code": "VALIDATION_ERROR",
    "message": "입력값을 다시 확인하세요.",
    "details": [
      { "field": "title", "message": "제목은 1~60자여야 합니다." }
    ]
  }
  ```
- 일시적 장애(데이터베이스 연결 실패 등): `503 Service Unavailable`
  ```json
  {
    "code": "SERVICE_UNAVAILABLE",
    "message": "일시적인 문제로 약속을 생성할 수 없습니다."
  }
  ```
- 예기치 못한 예외: `500 Internal Server Error` 동일 구조(`code`, `message`)로 응답하고 내부 로그에 스택 트레이스를 남긴다.

## 3. HTTP 레이어 설계
- 라우터: `api/routes/appointments.ts`에 `router.post('/')`로 정의.
- 미들웨어 체인:
  1. Pino 요청 로거(요청/응답 요약 기록, 본문은 200자 내로 잘라 로그에 포함)
     - 인프라 계층에서 부여한 `X-Request-Id` 헤더를 로거 컨텍스트에 포함시키며, 백엔드는 새 요청 ID를 생성하지 않는다.
  2. 스키마 기반 입력 검증(`validateBody(createAppointmentSchema)`) → 실패 시 §2.3의 400 응답 형식 반환
- 검증 통과 시 정제된 DTO `{ title, summary, timeSlotTemplateId }`만을 서비스 계층에 전달하고, 원본 `req.body`는 이후 로직에서 사용하지 않는다.

## 4. 서비스 레이어 설계
- 서비스 위치: `api/services/create-appointment-service.ts`
- 공개 인터페이스: `async create({ title, summary, timeSlotTemplateId }): Promise<CreateAppointmentResult>`
- 처리 흐름
  1. `TimeSlotTemplateCatalog.getActiveTemplates()`로 활성 템플릿 목록 조회 (§5)
  2. 템플릿 존재 여부 확인 → 없으면 `ValidationError` throw
  3. Prisma 트랜잭션 시작
     - `AppointmentRepository.create(tx, { title, summary, timeSlotTemplateId })`
     - 결과 `appointment.id`를 `ShareUrlBuilder.buildRelative(appointment.id)`에 전달하여 `/appointments/{id}` 생성
  4. 트랜잭션 커밋 후 DTO `{ appointmentId, shareUrl, title, summary, timeSlotTemplateId, createdAt }` 반환
  5. Pino 로거에 `appointment.created` 이벤트 기록(요약은 200자 제한), Prometheus 카운터 증가 (§6)
- 트랜잭션 내부에서 예외 발생 시 Prisma가 롤백하며, 서비스는 예외 유형에 따라 400/503/500으로 변환한다.

## 5. 시간 슬롯 템플릿 검증 및 캐싱
- 구성 요소: `TimeSlotTemplateCatalog`
  - 초기 구현은 코드 상수 배열(`default_weekly` 등) 기반.
  - `getActiveTemplates()` 호출 시 5분 TTL의 인메모리 캐시(`lru-cache` 또는 Node `Map` + 만료 시간) 활용.
  - TTL 만료 후 최초 요청은 원본 소스(현재는 상수, 향후 DB/외부 서비스)에서 다시 로드하여 캐시를 갱신한다.
  - 향후 DB 기반 확장을 고려하여 인터페이스 `loadTemplates(): Promise<Template[]>`를 추상화 계층으로 분리.

## 6. 관측 가능성 및 모니터링
- 로깅
  - 모든 성공/실패 요청에 대해 Pino 구조적 로그 작성.
  - 인프라 계층이 전달한 `requestId`를 로그 바인딩에 포함하여 추적 가능성을 확보하고, 백엔드에서 임의 생성하지 않는다.
  - 성공 시 `event: 'appointment.created'`, `appointmentId`, `templateId` 포함.
  - 사용자 입력 문자열은 로그에 포함 시 최대 200자로 잘라내고, 추가 이스케이프 없이 원문을 저장소에는 그대로 저장.
- 메트릭
  - Prometheus 카운터 `appointments_created_total`을 등록.
  - 레이블: `template_id` (현재 `default_weekly`), `result` (`success` 또는 오류 코드).
  - 성공 응답 시 `result=success`로 증가, 검증 오류 등 실패 시 적절한 `result` 값으로 증가하여 알람에 활용.

## 7. 데이터 영속화
- PostgreSQL 테이블 `appointments`
  | 컬럼 | 타입 | 제약 |
  | --- | --- | --- |
  | `id` | `UUID` | PK, 기본값 `gen_random_uuid()` |
  | `title` | `VARCHAR(60)` | NOT NULL |
  | `summary` | `VARCHAR(200)` | NOT NULL DEFAULT `''` |
  | `time_slot_template_id` | `TEXT` | NOT NULL |
  | `created_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL, 기본값 `now()` |
- Prisma 모델 (예시)
  ```prisma
  model Appointment {
    id                  String   @id @default(uuid()) @db.Uuid
    title               String   @db.VarChar(60)
    summary             String   @default("") @db.VarChar(200)
    timeSlotTemplateId  String   @map("time_slot_template_id")
    createdAt           DateTime @default(now()) @map("created_at")
  }
  ```
- `summary` 필드는 Prisma 스키마와 DB 모두에서 필수 문자열로 정의하여 `null` 저장을 방지한다.
- 저장 시 입력 값이 없으면 서비스 계층에서 `""`로 치환한 후 전달한다.

## 8. 오류 처리 전략
- `ValidationError` → HTTP 400 + `VALIDATION_ERROR` 응답, `details` 배열에 필드별 메시지 제공.
- Prisma `PrismaClientKnownRequestError` 중 연결/시간 초과 코드 → HTTP 503 + `SERVICE_UNAVAILABLE` 응답.
- 그 외 예외 → HTTP 500. Pino 로거에 `err` 필드로 전체 스택 기록.
- 오류 응답에도 Prometheus 카운터를 `result` 레이블로 증가시켜 장애 비율을 추적.

## 9. 비기능 요구 사항
- 약속 생성 요청당 데이터베이스 트랜잭션은 한 번만 수행하며, 트랜잭션 외부에서 비동기 작업을 추가 실행하지 않는다.
- 백엔드 레이어에서는 CORS 및 레이트 리밋을 구현하지 않는다. 해당 정책은 리버스 프록시 등 인프라 계층에서 처리한다.
- 입력 문자열은 DB에 저장할 때 이스케이프하지 않지만, SQL 인젝션 방지를 위해 ORM 파라미터 바인딩을 사용한다.
- 로그 민감도: PII가 없음을 가정하나, 입력 데이터는 불필요하게 장기 보관하지 않도록 로그 보존 정책을 운영과 협의한다.

## 10. 테스트 전략
- 단위 테스트
  - `createAppointmentSchema` 검증 성공/실패 케이스.
  - `TimeSlotTemplateCatalog` 캐시 만료 및 템플릿 검증 시나리오.
  - `ShareUrlBuilder`가 항상 상대 경로를 반환하는지 확인.
- 통합 테스트 (Supertest + 테스트 DB)
  - 유효한 요청이 201과 예상 응답 페이로드를 반환.
  - `title` 길이 초과, `summary` 초과, 존재하지 않는 템플릿 등 400 시나리오.
  - DB 장애 시 模擬하여 503 응답과 카운터 증가 여부 검증.
- 회귀 테스트
  - `appointments_created_total` 메트릭 노출 엔드포인트(`/metrics`)에서 카운터 증가를 확인.
  - 인프라가 제공한 `X-Request-Id`를 로그가 그대로 반영하는지 로그 캡처 기반 검증.

## 11. 연계 명세
- 사용자 경험 및 입력 규칙은 `meal-appointment-create-appointment-user-spec.md`와 일치해야 한다.
- UI/UX 레이아웃에서 사용하는 필드 명칭과 API 응답 스키마는 `meal-appointment-create-appointment-uiux-spec.md`를 지원한다.
- 아키텍처 수준에서 정의한 Express-PostgreSQL 스택 및 배포 전략은 `meal-appointment-architecture-spec.md`를 따른다.
- 도메인 규칙 및 약속 모델은 `meal-appointment-domain-spec.md`에서 정의한 요구사항을 구현한다.
