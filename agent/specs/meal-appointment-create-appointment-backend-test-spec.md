# 식사 약속 생성 백엔드 테스트 명세

## 1. 목적과 범위
- 본 테스트 명세는 `POST /appointments` 엔드포인트 구현(참조: `meal-appointment-create-appointment-backend-spec.md`)을 검증하기 위한 자동화 테스트 전략과 시나리오를 정의한다.
- 검증 대상은 Express 라우팅, 입력 검증 미들웨어, 서비스 계층, Prisma 레포지터리, 캐시 계층, 로깅 및 관측성 훅을 포함한 백엔드 전 영역이다.
- 비로그인 약속 생성 흐름만을 다루며, 조회/참여/프런트엔드 연동 테스트는 범위에서 제외한다.

## 2. 테스트 환경 전제
- 테스트 실행 전 `api-server` 워크스페이스에서 `npm install`, `npx prisma generate` 수행.
- 통합 테스트 이상 수준에서는 PostgreSQL 15 이상이 필요하며, 테스트 전용 DB(`meal_appointment_test`)를 준비하고 Prisma 마이그레이션을 적용한다.
- 모든 테스트는 `.env.test` 환경 파일을 사용하고, 로거는 콘솔 transport를 mock 하거나 캡처하여 검증한다.
- 캐시 TTL(5분)은 테스트 중 단축하거나 수동 무효화를 위해 `ActiveTemplateCache` 인터페이스에 주입 가능한 클록/스토리지 어댑터를 사용한다.

## 3. 테스트 계층별 전략
### 3.1 단위 테스트 (Jest, runInBand)
- **대상 모듈**: 입력 검증 스키마, `ShareUrlBuilder`, 캐시 어댑터, 서비스 계층의 의존성 경계.
- **목표**: 외부 I/O 없이 순수 로직 검증. Prisma, Express 객체는 mock/stub 사용.
- **설정**: `jest --selectProjects unit` 구성 활용, 각 테스트 후 mock reset.

### 3.2 통합 테스트 (Jest + Supertest)
- **대상 모듈**: Express 라우터 ↔ 서비스 ↔ Prisma ↔ PostgreSQL.
- **목표**: 실제 HTTP 요청을 통해 엔드투엔드로 계약(201 응답, 오류 코드, 직렬화 규칙) 확인.
- **설정**: `jest --selectProjects integration`, 테스트 간 데이터 격리를 위해 트랜잭션 롤백 또는 테이블 truncate 적용.

### 3.3 관측성/로깅 검증
- **대상 모듈**: Pino 로거, Prometheus metrics emitter.
- **목표**: 성공/실패 시 로그 필드, metric 증분을 확인.
- **설정**: Pino transport를 test double로 교체, metrics 레지스트리를 테스트 전 초기화.

## 4. 테스트 시나리오 상세
### 4.1 입력 검증 미들웨어 단위 테스트
| ID | 시나리오 | 절차 | 예상 결과 |
| --- | --- | --- | --- |
| UV-01 | 제목/요약 trimming | 공백 포함 `title`, `summary` 입력으로 스키마 validate 호출 | 반환 DTO에서 양 끝 공백 제거 |
| UV-02 | 제목 길이 0 | 빈 문자열 `title` → validate | `VALIDATION_ERROR`, field=`title` |
| UV-03 | 제목 길이 61 | 61자 문자열 | `VALIDATION_ERROR`, message 길이 규칙 명시 |
| UV-04 | 요약 미제공 | `summary` 누락 | DTO에서 빈 문자열로 대체 |
| UV-05 | 요약 201자 | 201자 문자열 | `VALIDATION_ERROR`, field=`summary` |
| UV-06 | 템플릿 ID 미등록 | `timeSlotTemplateId`가 캐시 미포함 값 | `VALIDATION_ERROR`, field=`timeSlotTemplateId` |
| UV-07 | JSON 타입 강제 | `title`, `summary`에 숫자 전달 | 문자열로 변환 후 규칙 적용, 위반 시 에러 |

### 4.2 서비스 계층 단위 테스트
| ID | 시나리오 | 의존성 세팅 | 예상 결과 |
| --- | --- | --- | --- |
| US-01 | 정상 생성 플로우 | `AppointmentRepository.create` mock → `{ id: uuid, createdAt }` 반환, `ShareUrlBuilder` mock | 서비스 결과에 `shareUrl=/appointments/{id}`, createdAt 그대로 전달 |
| US-02 | 캐시 히트 | `ActiveTemplateCache.get` → `['default_weekly']` | 레포지터리 호출, 캐시 재조회 없음 |
| US-03 | 캐시 미스 후 로드 | `ActiveTemplateCache.get` → null, `TemplateProvider.load` → 목록 반환 | 캐시 `set` 호출, 이후 서비스 성공 |
| US-04 | 레포지터리 장애 | `AppointmentRepository.create` → throw | 서비스가 `SERVICE_UNAVAILABLE` 에러 throw |
| US-05 | Share URL 상대 경로 강제 | `ShareUrlBuilder.buildRelativePath` mock 호출 추적 | 절대 URL 조합 시도 없음, 입력 id 그대로 전달 |
| US-06 | 로깅 필드 검증 | Logger mock | `appointment.created` info 로그에 preview 필드 포함 |
| US-07 | 메트릭 증가 | Metrics 레지스트리 mock | `appointments_created_total`에 template 레이블로 1 증가 |

### 4.3 ShareUrlBuilder 단위 테스트
- 입력: UUID 문자열 → 결과 `/appointments/{uuid}` 확인.
- 절대 URL 입력이나 환경 변수 조합 없이 상대 경로만 반환하는지 검증.

### 4.4 캐시 TTL/무효화 단위 테스트
- 5분 TTL을 가정하여 fake timer 사용.
- 캐시 set 이후 TTL 경과 전에는 기존 값 반환, 경과 후에는 null 반환하여 재로딩 유도.

### 4.5 Express 라우터 통합 테스트 (Supertest)
| ID | 시나리오 | 요청 | 예상 응답/검증 |
| --- | --- | --- | --- |
| IT-01 | 정상 생성 | `POST /appointments` JSON: `{ title, summary, timeSlotTemplateId }` | `201`, 응답 본문에 `appointmentId`, `shareUrl` 상대 경로, ISO `createdAt`; DB 레코드 존재 |
| IT-02 | 요약 미제공 | `summary` 누락 | `201`, 응답 `summary=""`; DB `summary` 빈 문자열 저장 |
| IT-03 | 템플릿 미등록 | 존재하지 않는 `timeSlotTemplateId` | `400`, 코드 `VALIDATION_ERROR`, errors 배열 포함 |
| IT-04 | 제목 길이 초과 | 61자 제목 | `400`, 오류 메시지 검증 |
| IT-05 | DB 장애 시 재시도 안내 | 테스트 중 Prisma 클라이언트 오류를 stub → throw | `503`, 코드 `SERVICE_UNAVAILABLE`, 로그에 error 수준 기록 |
| IT-06 | 예기치 않은 오류 | 서비스에서 일반 예외 throw | `500`, 코드 `INTERNAL_SERVER_ERROR`, `requestId` 유지 |
| IT-07 | 요청 ID 전파 | 헤더 `x-request-id` 설정 | 응답/로그 모두 동일 ID 포함 |
| IT-08 | created 로그 | 정상 요청 후 logger spy 확인 | `appointment.created` info 로그 1회 |
| IT-09 | 메트릭 증가 | 정상 요청 후 metrics 레지스트리 확인 | `appointments_created_total{time_slot_template_id}` == 1 |

### 4.6 데이터 무결성 확인
- Prisma를 통해 생성된 레코드에서 `title`이 트리밍된 상태인지, `summary`가 빈 문자열인지, `created_at`이 자동 타임스탬프인지 확인.
- 레코드가 중복 생성되지 않도록 트랜잭션이 한 번만 실행되었는지 Prisma query 로그로 검증.

### 4.7 레이트 리밋/인프라 협업 테스트 (옵션)
- API Gateway 모킹 또는 Nginx 테스트 더블을 통해 429 응답이 전달되었을 때 백엔드가 내용을 변환하지 않고 passthrough 하는지 확인.

## 5. 비기능 테스트 고려사항
- 테스트 실행 시간 단축을 위해 통합 테스트는 Jest에서 `--runInBand` 유지, DB 초기화는 `beforeEach`에서 빠른 TRUNCATE 사용.
- 로깅/메트릭 검증 시 실제 외부 시스템(Prometheus pushgateway 등)에 의존하지 않고 in-memory 레지스트리 사용.
- 병렬 실행 시 캐시 스토어를 테스트별 인스턴스로 생성하여 데이터 경합 방지.

## 6. 커버리지 및 리포트
- 단위/통합 테스트 모두에서 커버리지 수집을 선택적으로 활성화하며, 서비스 계층과 검증 미들웨어의 분기 커버리지를 90% 이상으로 유지한다.
- CI 파이프라인에서 `coverage/` 디렉터리를 수집하여 `meal-appointment-create-appointment-backend-spec.md` 요구사항 충족 여부를 리뷰어가 추적할 수 있게 한다.

## 7. 관련 명세
- `agent/specs/meal-appointment-create-appointment-backend-spec.md`
- `agent/specs/meal-appointment-domain-spec.md`
- `agent/specs/meal-appointment-architecture-spec.md`
- `agent/specs/meal-appointment-local-testing-spec.md`
