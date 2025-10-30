# 식사 약속 생성 백엔드 명세

## 1. 개요
- 목적: 비로그인 사용자가 식사 약속을 생성하고 공유 URL을 획득할 수 있도록 REST API와 관련 백엔드 구성요소를 정의한다.
- 범위: Express 애플리케이션의 HTTP 계층, 서비스 계층, 영속화 계층, 검증/캐싱, 로깅 및 모니터링, 테스트 전략.
- 미지원 항목: CORS 제어 및 레이트 리밋은 백엔드가 담당하지 않으며 인프라 레이어에서 처리하고 운영 문서에 해당 내용을 명시한다.

## 2. 엔드포인트 정의
- 경로 및 메서드: `POST /appointments`
- 인증: 로그인 불필요. 익명 요청만 허용한다.
- 요청 헤더: `Content-Type: application/json` 필수. 추적을 위해 요청 ID 미들웨어가 `x-request-id`를 생성/전파한다.
- 요청 본문 JSON 스키마:
  ```json
  {
    "title": "string (필수)",
    "summary": "string (선택, 누락 시 빈 문자열 처리)",
    "timeSlotTemplateId": "string (필수)"
  }
  ```
- 응답: 성공 시 HTTP 201 Created. 본문은 camelCase JSON:
  ```json
  {
    "appointmentId": "string",
    "shareUrl": "/appointments/{appointmentId}",
    "title": "string",
    "summary": "string",
    "timeSlotTemplateId": "string",
    "createdAt": "ISO-8601 string"
  }
  ```
- 공유 URL은 항상 상대 경로(`/appointments/{appointmentId}`)만 반환한다. `PUBLIC_BASE_URL` 환경 변수 유무와 관계없이 절대 URL을 구성하지 않는다.

## 3. 입력 검증 및 정규화
- Express 미들웨어에서 JSON 스키마 검증을 수행한다. 권장 도구: Zod 또는 Joi.
- 필드별 규칙:
  - `title`: 문자열로 강제 변환 후 앞뒤 공백을 제거. 길이 1~60자 범위를 벗어나면 400 `VALIDATION_ERROR`.
  - `summary`: 누락 시 빈 문자열로 대체. 문자열로 캐스팅 후 앞뒤 공백을 제거하지 않는다(사용자 입력 유지). 길이 0~200자. 범위 위반 시 400 `VALIDATION_ERROR`.
  - `timeSlotTemplateId`: 문자열인지 확인하고 활성 템플릿 레지스트리에서 존재 여부를 검증한다. 미존재 시 400 `VALIDATION_ERROR`.
- 검증 오류 응답 구조:
  ```json
  {
    "error": "VALIDATION_ERROR",
    "details": [
      {
        "field": "title",
        "code": "REQUIRED | TOO_SHORT | TOO_LONG"
      }
      // ...필요한 만큼 반복
    ]
  }
  ```
- 검증 미들웨어는 성공 시 정제된 DTO `{ title, summary, timeSlotTemplateId }`만 서비스 계층에 전달한다.

## 4. 시간 슬롯 템플릿 관리
- 활성 템플릿 목록은 `ActiveTemplateService`가 제공한다.
- 데이터 소스: 초기 버전은 애플리케이션 내 상수 목록(`default_weekly` 포함)을 사용하되, 추후 DB 기반 확장을 고려해 서비스 인터페이스를 정의한다.
- 캐싱: 5분 TTL 메모리 캐시를 사용하여 템플릿 목록 조회 빈도를 줄인다. 캐시 만료 시 백엔드가 소스에서 목록을 재로딩한다.

## 5. 서비스 계층 동작
- `CreateAppointmentService`는 다음 단계를 단일 트랜잭션으로 수행한다.
  1. `AppointmentRepository.create`를 호출하여 `appointments` 테이블에 새 레코드를 삽입한다.
  2. `ShareUrlBuilder`를 호출하여 `/appointments/{appointmentId}` 형식의 상대 경로를 생성한다.
  3. 트랜잭션 완료 후 위 데이터를 응답 DTO로 매핑한다.
- 트랜잭션 실패 시 503 `SERVICE_UNAVAILABLE` 오류를 발생시키고 호출자는 재시도 전략을 취할 수 있다.

## 6. 영속화
- 데이터베이스: PostgreSQL, Prisma ORM 사용.
- `appointments` 테이블 스키마:
  - `id` (UUID, PK, NOT NULL)
  - `title` (VARCHAR(60), NOT NULL)
  - `summary` (VARCHAR(200), NOT NULL DEFAULT '')
  - `time_slot_template_id` (VARCHAR(64), NOT NULL)
  - `created_at` (TIMESTAMP WITH TIME ZONE, NOT NULL DEFAULT NOW())
- Prisma 모델 정의 예시:
  ```prisma
  model Appointment {
    id                 String   @id @default(uuid())
    title              String   @db.VarChar(60)
    summary            String   @default("") @db.VarChar(200)
    timeSlotTemplateId String   @map("time_slot_template_id") @db.VarChar(64)
    createdAt          DateTime @default(now()) @map("created_at")
  }
  ```
- `summary` 필드는 선택 입력이더라도 모델에서는 필수 문자열로 정의하며 기본값이 빈 문자열이 되도록 한다.

## 7. 응답 직렬화 및 로깅
- 응답 DTO는 camelCase로 직렬화한다 (Express 기본 JSON 직렬화 사용).
- 로깅: Pino 로거를 사용하여 다음 정보를 기록한다.
  - 성공 시: `appointment.created` 이벤트, payload에 `appointmentId`, `timeSlotTemplateId`, `requestId` 포함. `title`과 `summary`는 200자까지 잘라서 로그에 기록한다.
  - 검증 실패, 시스템 오류 시: `error` 레벨 로그에 `requestId`, 오류 코드, 메시지.
- 요청 ID 미들웨어가 모든 로그에 `requestId` 필드를 추가하도록 설정한다.

## 8. 오류 처리
- 검증 실패: HTTP 400 + `VALIDATION_ERROR` 구조 (섹션 3 참조).
- 트랜잭션 실패 또는 외부 리소스 일시 장애: HTTP 503 + `{ "error": "SERVICE_UNAVAILABLE" }`.
- 예기치 못한 예외: HTTP 500 + `{ "error": "INTERNAL_SERVER_ERROR" }`. 내부적으로 스택 트레이스를 기록한다.

## 9. 모니터링 및 계측
- Prometheus 카운터 `appointments_created_total`을 정의하고 성공적인 생성마다 1씩 증가시킨다. 라벨: `timeSlotTemplateId`.
- 계측 코드에 대한 단위 테스트 또는 메트릭 등록 검증을 준비한다 (예: Counter 인스턴스가 호출되는지 목 검증).

## 10. 보안 및 운영 고려사항
- 입력 문자열은 DB에 이스케이프 없이 원문 저장하되, 로그에 기록할 때만 200자 제한을 적용한다.
- CORS 정책과 레이트 리밋은 인프라 레이어(예: API 게이트웨이, 리버스 프록시)에서 다룬다. 백엔드는 관련 운영 문서에 해당 책임 위치를 명시한다.

## 11. 테스트 전략
- 단위 테스트:
  - 검증 미들웨어가 정상 입력과 오류 케이스(제목 길이, 요약 길이, 템플릿 미존재)를 처리하는지 확인.
  - `CreateAppointmentService`가 저장/URL 생성/메트릭 증가/로그 호출 순서를 지키는지 검증.
  - `ActiveTemplateService` 캐시 TTL 동작 테스트.
- 통합 테스트:
  - 실제 Express 라우트에 대해 성공 케이스(201 응답, 필드 값, 상대 shareUrl)를 검증.
  - 검증 실패(400), 템플릿 미존재, DB 예외 모킹 후 503, 예상치 못한 예외 시 500을 확인.
- 회귀 테스트:
  - 전체 플로우에 대한 시나리오 기반 테스트를 작성하여 명세 위반 회귀를 방지한다.

## 12. 문서화
- API 문서(예: OpenAPI)와 운영 문서에 위 스펙을 반영한다.
- 특히 CORS 및 레이트 리밋이 인프라 책임이라는 사실을 운영 문서에 명시한다.
