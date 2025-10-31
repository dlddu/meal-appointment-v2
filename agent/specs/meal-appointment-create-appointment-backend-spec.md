# 식사 약속 생성 백엔드 구현 명세

## 1. 목적과 범위
- 본 명세는 `POST /appointments` 엔드포인트를 구현하는 백엔드 계약, 계층 간 상호작용, 데이터 저장 규칙을 정의한다.
- 로그인이나 세션 없이 약속을 생성하는 시나리오만을 다루며, 이후 조회·참여 기능은 범위에서 제외한다.
- 기존 도메인 명세(`meal-appointment-domain-spec.md`)와 아키텍처 명세(`meal-appointment-architecture-spec.md`)의 흐름을 따른다.

## 2. 엔드포인트 계약
- **HTTP 메서드 및 경로:** `POST /appointments`
- **인증:** 비로그인 공개 엔드포인트. 인증 미들웨어를 적용하지 않는다.
- **요청 본문:** `Content-Type: application/json`
  ```json
  {
    "title": "string",
    "summary": "string | undefined",
    "timeSlotTemplateId": "string"
  }
  ```
- **성공 응답:** `201 Created`
  ```json
  {
    "appointmentId": "string",
    "shareUrl": "/appointments/{appointmentId}",
    "title": "string",
    "summary": "string",
    "timeSlotTemplateId": "string",
    "createdAt": "ISO-8601 timestamp"
  }
  ```
- **응답 URL 규칙:** `shareUrl`은 항상 상대 경로(`/appointments/{appointmentId}`)를 반환한다. `PUBLIC_BASE_URL` 또는 기타 환경 변수로 절대 URL을 조합하지 않는다.

## 3. 입력 검증 및 미들웨어 계층
- Express 라우터 수준에서 스키마 기반 검증(예: Zod, Yup 등)을 수행한다.
- 미들웨어는 다음 규칙을 준수한 정제된 DTO만 서비스 계층에 전달한다.
  - `title`: 문자열로 강제 변환 후 앞뒤 공백을 제거한다. 길이가 1~60자를 벗어나면 `VALIDATION_ERROR`를 발생시킨다.
  - `summary`: 미제공 시 빈 문자열(`""`)로 대체한다. 0~200자를 초과하면 `VALIDATION_ERROR`.
  - `timeSlotTemplateId`: 문자열 여부를 확인하고 활성 템플릿 식별자 목록에 존재하는지 검증한다.
- 검증 실패 시 `res.status(400)`과 `VALIDATION_ERROR` 코드를 반환하며, 필드별 오류 메시지를 배열로 제공한다.

## 4. 활성 템플릿 관리
- 활성 템플릿 식별자 목록은 서비스 계층에서 5분 TTL 캐시로 관리한다.
  - 기본 구현: 인메모리 캐시(키: `active-time-slot-templates`).
  - 캐시 미스 시 설정 파일 또는 향후 DB 테이블에서 목록을 로드할 수 있도록 인터페이스를 분리한다.
- 초기 템플릿으로 `default_weekly`를 포함하며, 추가 템플릿 지원 시 동일한 캐시 경로를 사용한다.

## 5. 서비스 계층 동작
1. 미들웨어에서 전달된 정제 DTO를 입력으로 받는다.
2. 단일 데이터베이스 트랜잭션을 열어 약속 레코드를 생성한다.
   - `AppointmentRepository.create(dto, tx)` 호출 시 `title`, `summary`, `timeSlotTemplateId`를 저장한다.
   - 생성된 `appointmentId`를 활용해 `ShareUrlBuilder.buildRelativePath(appointmentId)`를 호출하여 `/appointments/{id}` 형태의 상대 경로를 반환한다.
3. 트랜잭션 커밋 후 응답 DTO를 구성한다.
4. 성공 시 `appointment.created` 이벤트를 Pino 로거에 `info` 수준으로 기록한다.

## 6. 데이터베이스 및 ORM 모델링
- **테이블:** `appointments`
  | 컬럼 | 타입 | 제약 | 설명 |
  | --- | --- | --- | --- |
  | `id` | `UUID` (PK) | NOT NULL | Prisma에서 `@id @default(uuid())` |
  | `title` | `VARCHAR(60)` | NOT NULL | 트리밍된 제목 |
  | `summary` | `VARCHAR(200)` | NOT NULL DEFAULT '' | 빈 문자열 허용. NULL 저장 금지 |
  | `time_slot_template_id` | `VARCHAR(64)` | NOT NULL | 활성 템플릿 식별자 |
  | `created_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL DEFAULT `NOW()` | 생성 시각 |
- **Prisma 모델:**
  ```prisma
  model Appointment {
    id                String   @id @default(uuid()) @db.Uuid
    title             String   @db.VarChar(60)
    summary           String   @default("") @db.VarChar(200)
    timeSlotTemplateId String  @map("time_slot_template_id") @db.VarChar(64)
    createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz
  }
  ```
- `summary`는 선택 필드로 모델링하지 않는다. 서비스 계층은 `summary ?? ''`가 아닌 필수 문자열을 인자로 받는다.

## 7. 응답 직렬화 규칙
- DTO 필드는 모두 `camelCase`로 직렬화한다.
- `createdAt`은 ISO-8601 문자열(`toISOString()`)로 응답한다.
- 내부 저장소는 스네이크 케이스를 사용할 수 있으나, 컨트롤러 응답에서 변환한다.

## 8. 오류 및 예외 처리
| 상황 | HTTP 상태 | 코드 | 메시지/세부 정보 |
| --- | --- | --- | --- |
| 입력 검증 실패 | 400 | `VALIDATION_ERROR` | `errors` 배열에 `{ field, message }` 객체 포함 |
| 레포지터리/외부 리소스 일시 장애 | 503 | `SERVICE_UNAVAILABLE` | 재시도 가능성을 안내하는 메시지 |
| 예기치 못한 서버 오류 | 500 | `INTERNAL_SERVER_ERROR` | 일반 메시지 반환, 상세 스택은 로그로만 남김 |
- 모든 오류 응답은 인프라 레벨에서 부여된 `requestId`를 그대로 포함하여 프런트엔드가 추적 가능하도록 한다.

## 9. 로깅 및 관측성
- Pino 로거를 사용하며, 인프라(예: API Gateway, 리버스 프록시)가 전달한 `requestId` 헤더를 그대로 활용한다. 애플리케이션은 `requestId`를 생성하거나 덮어쓰지 않는다.
- `appointment.created` 로그에는 다음 필드를 포함한다: `appointmentId`, `timeSlotTemplateId`, `titlePreview`(제목 앞 60자), `summaryPreview`(요약 앞 200자, 로그에서만 트렁케이션 적용).
- 성공 시 Prometheus 카운터 `appointments_created_total`을 1 증가시키고, 레이블로 `time_slot_template_id`를 포함한다.
- 오류 발생 시 해당 `requestId`, 상태 코드, 오류 코드를 `error` 수준으로 기록한다.

## 10. 비기능 요구사항
- IP 기준 분당 30회 호출 제한은 인프라 레이어(API Gateway/리버스 프록시)에서 적용한다. 애플리케이션 서버는 자체 레이트 리밋 미들웨어를 두지 않고, 인프라에서 전달한 429 응답 형식을 운영 표준과 맞추도록 문서화한다.
- CORS 처리는 백엔드 애플리케이션에서 수행하지 않는다. 필요한 허용 도메인은 리버스 프록시/인프라 레벨 구성으로 대응하며, 운영 문서에 해당 사실을 명시한다.
- 입력 문자열은 데이터베이스에는 원문 그대로 저장하되, 로그에 기록할 때만 위에서 정의한 길이 제한을 적용한다. 추가적인 HTML 이스케이프는 하지 않는다.

## 11. 테스트 전략
- **단위 테스트:**
  - 검증 미들웨어가 잘못된 입력을 차단하고 정제된 DTO를 반환하는지 확인한다.
  - `ShareUrlBuilder`가 상대 경로만 생성하고 절대 URL을 만들지 않는지 검증한다.
  - 서비스 계층이 캐시된 템플릿 목록을 사용하는지, 캐시 만료 시 재로딩하는지 확인한다.
- **통합 테스트:**
  - 실제 데이터베이스(또는 트랜잭션 롤백 패턴)를 사용해 약속 생성 요청이 201 응답과 올바른 페이로드를 반환하는지 확인한다.
  - 503/500 시나리오에 대해 적절한 오류 코드와 로깅이 수행되는지 확인한다.
- **운영 연계 테스트:** 인프라 레벨 레이트 리밋이 429 응답을 반환할 때 프록시가 표준 오류 본문과 `requestId`를 유지하는지 별도 연동 테스트로 확인한다.
- **회귀 테스트:** 약속 생성 흐름을 E2E로 검증하여 공유 URL이 상대 경로이며 프런트엔드와의 계약이 깨지지 않는지 확인한다.

## 12. 운영 문서 연계
- 운영 가이드는 백엔드가 CORS를 처리하지 않으며, 허용 도메인 관리는 인프라 레이어에서 수행된다는 점을 명확히 한다.
- 향후 활성 템플릿이 데이터베이스로 이전될 경우 캐시 초기화/만료 전략을 업데이트하도록 운영 절차에 반영한다.

## 13. 관련 명세
- `agent/specs/meal-appointment-domain-spec.md`: 약속 생성 도메인 흐름 및 템플릿 개념.
- `agent/specs/meal-appointment-architecture-spec.md`: Express 기반 API와 관측성 표준.
- `agent/specs/meal-appointment-create-appointment-user-spec.md`: 사용자 요청·응답 기대치.
