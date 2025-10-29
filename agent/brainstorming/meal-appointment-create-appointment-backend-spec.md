# 식사 약속 생성 백엔드 구현 브레인스토밍 명세

## 1. 목표와 범위
- 사용자 명세(`agent/specs/meal-appointment-create-appointment-user-spec.md`)에 정의된 약속 생성 흐름을 만족하는 `POST /appointments` 백엔드 기능을 설계한다.
- 로그인 없이 접근하는 생성자에게 제목, 설명, 시간 슬롯 템플릿을 검증·저장하고 공유 URL을 반환하는 데 필요한 API 계층, 서비스 계층, 데이터 계층 책임을 식별한다.
- 동일 요청 다중 제출, 서버 오류, 네트워크 실패 시의 대응 전략을 포함한다.

## 2. 입력/출력 계약
- **요청 본문(JSON)**
  - `title`: 문자열, 1~60자. 앞뒤 공백 제거 후 빈 문자열이면 거부.
  - `summary` (클라이언트 설명 필드 매핑): 문자열, 0~200자. 비어도 허용되며 허용 길이를 초과하면 거부.
  - `timeSlotTemplateId`: 문자열, 현재는 `default_weekly` 하나만 유효. 향후 템플릿 확장을 고려해 목록 기반 검증 구조 유지.
- **응답 201(JSON)**
  - `appointmentId`: UUID v4.
  - `shareUrl`: `/appointments/{appointmentId}` 상대 경로. 베이스 URL 합성은 클라이언트 책임으로 남기되 서버는 환경변수 `PUBLIC_BASE_URL`이 설정된 경우 절대 URL을 반환하도록 유연성 확보.
  - `title`, `summary`, `timeSlotTemplateId`, `createdAt`(ISO-8601) 포함하여 생성 직후 확인 화면에서 재사용 가능하도록 한다.
- **헤더**: `Content-Type: application/json` 요청/응답.

## 3. 유효성 및 비즈니스 규칙
- 입력 필드는 zod 혹은 class-validator가 아닌 Express 미들웨어에서 schema(예: zod) 기반으로 검증하여 서비스 계층으로 전달.
- `title`의 공백 제거는 서버에서 일관되게 수행하고, 잘린 문자열 길이를 기준으로 검증.
- `summary`는 `null`/`undefined` 허용하지 않고 빈 문자열로 대체해 저장, 추후 조회 시 그대로 반환.
- `timeSlotTemplateId` 검증은 구성 파일 또는 DB `time_slot_templates` 테이블에서 `is_active=true` 목록을 조회하여 수행. 초기에는 하드코딩 리스트(단일 값) 후 추후 DB 기반으로 전환해도 서비스 계층 계약을 유지할 수 있도록 리포지터리 인터페이스 정의.
- 중복 생성 허용이므로 동일 제목/설명이라도 거부하지 않는다.

## 4. 서비스 계층 동작
1. 트랜잭션 시작(Prisma `appointment` create는 단일 insert이지만 향후 확장을 위해 서비스 함수 내부에서 에러 처리 일관성 유지).
2. `AppointmentRepository.create` 호출: UUID 생성은 DB(default uuid_generate_v4()) 또는 Prisma에서 처리.
3. 생성된 엔티티 반환 후 `ShareUrlBuilder` 유틸에서 `appointmentId` 기반 경로 생성. 절대 URL 반환 조건은 환경설정(`config.createAppointment.shareAbsoluteUrl`)을 확인.
4. 응답 DTO 매핑: 저장된 레코드의 필드를 camelCase로 변환하여 JSON 직렬화.
5. 감시 로그: `info` 레벨로 `appointment.created` 이벤트 기록(식별자, 템플릿, truncated title).

## 5. 데이터 계층 및 스키마 고려
- `appointments` 테이블 컬럼: `id UUID PK`, `title VARCHAR(60) NOT NULL`, `summary VARCHAR(200) NULL DEFAULT ''`, `time_slot_template_id TEXT NOT NULL`, `created_at TIMESTAMP WITH TIME ZONE DEFAULT now()`.
- Prisma 모델 정의 시 `summary`를 선택적 필드로 지정하고, 생성 시 `summary ?? ''` 처리.
- 템플릿 유효성 검증을 위해 초기 시드 데이터 `time_slot_templates`에 `default_weekly` 등록. 서비스는 활성 템플릿 목록을 캐시(예: 메모리 5분)하여 반복 검증 비용을 줄인다.
- 트랜잭션 로그/감사 필요 시 향후 `appointment_events` 테이블을 추가할 수 있도록 리포지터리 레이어에서 이벤트 저장 훅을 허용.

## 6. 오류 처리 전략
- **400 Bad Request**: 검증 실패. 응답 본문 `{ "error": "VALIDATION_ERROR", "details": [{ "field": "title", "message": "제목은 1~60자여야 합니다." }] }` 형식.
- **503 Service Unavailable**: 데이터베이스 연결 오류 등 일시적 장애 시. 사용자 메시지는 사용자 명세의 "일시적인 문제" 문구를 클라이언트에서 표현할 수 있도록 `{ "error": "SERVICE_UNAVAILABLE" }` 반환.
- **500 Internal Server Error**: 예상치 못한 예외. 로깅 후 일반 메시지 반환.
- 네트워크 재시도 안내를 위해 idempotency 토큰은 제공하지 않지만, 클라이언트 재시도 시 중복 약속이 생성될 수 있음을 문서화.

## 7. 보안 및 운영 고려
- 인증 없이 접근 가능한 엔드포인트이므로 레이트 리밋(예: IP 기준 분당 30회)을 적용.
- CORS 정책에서 `POST /appointments` 허용 도메인 제한(프런트엔드 배포 도메인, 로컬 개발 도메인).
- 입력 필드에 대한 HTML/스크립트 포함은 허용하되 저장 시 escaping 하지 않고 조회 시 클라이언트에서 이스케이프하도록 명세. 단, 로깅 시 XSS 방지를 위해 제목/설명 문자열은 200자 이하로 잘라 기록.
- Pino logger + request ID 미들웨어 도입으로 추적성 확보.

## 8. 테스트 및 품질 보증
- 단위 테스트: 서비스 계층에서 유효 템플릿/제목/설명 조합에 대해 성공/검증 실패 시나리오 작성.
- 통합 테스트: Supertest로 `POST /appointments` 호출 → 201 응답, DB에 레코드 생성, shareUrl 형식 검증.
- 회귀 테스트: 템플릿 목록이 변경되어도 `default_weekly`가 비활성화되면 400 반환되는지 확인.
- observability: Prometheus 카운터 `appointments_created_total` 증가 여부에 대한 테스트는 e2e 범위에서 확인.
