# 식사 약속 조회 백엔드 테스트 명세

## 1. 목적과 범위
- 본 테스트 명세는 공개 조회 엔드포인트 `GET /api/appointments/{appointmentId}` 구현(참조: `meal-appointment-view-appointment-backend-implementation-spec.md`)이 계약(`meal-appointment-view-appointment-backend-spec.md`)과 사용자 시나리오(`meal-appointment-view-appointment-user-spec.md`)를 충족하는지 검증한다.
- 검증 범위는 Express 라우터, 컨트롤러, 서비스 계층, Prisma 레포지터리, 템플릿 캐시, 가용성 집계 도우미, 로깅/메트릭 연동을 포함한다.
- 약속 생성, 응답 제출, 프런트엔드 렌더링 테스트는 범위에서 제외한다.

## 2. 테스트 환경 전제
- `api-server` 패키지에서 `npm install`, `npx prisma generate`를 사전에 실행한다.
- 통합 테스트 이상 레벨에서는 PostgreSQL 15+ 테스트 데이터베이스(`meal_appointment_test`)를 사용하고 Prisma 마이그레이션을 적용한다.
- 모든 테스트 실행 시 `.env.test`를 로드하며, `REQUEST_ID_HEADER` 등 환경 변수는 기본값을 사용하거나 테스트 내에서 명시적으로 주입한다.
- 템플릿 캐시는 테스트마다 별도 인메모리 구현을 주입하거나 TTL을 단축(예: 5초)하여 만료 시나리오를 제어한다.
- 로거(Pino)와 메트릭(Prometheus client)은 테스트 더블로 교체하여 호출 여부와 페이로드를 단언한다.

## 3. 테스트 계층별 전략
### 3.1 단위 테스트 (Jest - `--selectProjects unit`)
- **대상 모듈**: `ViewAppointmentService`, `AvailabilityAggregator`, 템플릿 캐시 어댑터, 오류 매핑 헬퍼.
- **목표**: 순수 로직 및 에러 분기 검증. Prisma/Express 의존성은 mock/stub 처리한다.
- **설정**: 각 테스트 종료 후 mock 초기화, fake timer를 사용해 캐시 TTL 시나리오 제어.

### 3.2 컨트롤러/라우터 테스트 (Jest - `--selectProjects unit`)
- **대상 모듈**: `ViewAppointmentController`, `AppointmentPublicRouter`.
- **목표**: 경로 파라미터 검증, `requestId` 전파, HTTP 상태/헤더/본문 직렬화 규칙 확인.
- **설정**: Supertest 없이 Express handler를 직접 호출하거나 `createMockResponse` 헬퍼 사용.

### 3.3 통합 테스트 (Jest + Supertest - `--selectProjects integration`)
- **대상 모듈**: Express 앱 ↔ 서비스 ↔ Prisma ↔ PostgreSQL.
- **목표**: 실제 HTTP 요청을 통해 성공/오류 응답, 정렬, 집계, 캐시 미스/히트 흐름을 종단 간 검증한다.
- **설정**: 테스트 케이스마다 DB를 TRUNCATE 후 시드 데이터를 삽입한다. 동일 템플릿을 여러 번 조회하는 케이스는 한 테스트 내에서 실행하여 캐시 상태를 관찰한다.

### 3.4 관측성/로깅 검증
- **대상 모듈**: Pino logger, Prometheus metrics emitter.
- **목표**: 성공 시 `appointment.viewed` 로그, 캐시 미스 로그, `http_server_requests_total`, `appointment_view_duration_ms`, `template_cache_hit_ratio` 갱신 여부 확인.
- **설정**: 로그 transport와 메트릭 레지스트리를 테스트 격리용 인스턴스로 대체하고, 각 테스트 후 초기화한다.

## 4. 테스트 시나리오 상세
### 4.1 AvailabilityAggregator 단위 테스트
| ID | 시나리오 | 입력 | 예상 결과 |
| --- | --- | --- | --- |
| AG-01 | 빈 응답 목록 | `[]` | `availableCountBySlotKey` 빈 맵, `totalSelections=0` |
| AG-02 | 단일 슬롯 선택 | `[ { participantId: 'p1', slotKey: '2024-03-01#LUNCH' } ]` | 해당 슬롯 카운트 1, 다른 슬롯 없음 |
| AG-03 | 중복 슬롯 키 | 두 참가자가 동일 `slotKey` 선택 | 카운트 2로 누적 |
| AG-04 | 템플릿 미정의 슬롯 | 템플릿에 없는 `slotKey` 포함 | 카운트에 그대로 반영(필터링 없음) |
| AG-05 | 다중 슬롯/참여자 | 다수 슬롯 혼합 | 모든 슬롯에 정확한 합산 반환 |

### 4.2 ViewAppointmentService 단위 테스트
| ID | 시나리오 | 의존성 세팅 | 예상 결과 |
| --- | --- | --- | --- |
| VS-01 | 정상 조회 | 레포지터리 mock이 약속/템플릿/참여자/응답을 반환 | 결과가 템플릿 슬롯 순서대로 `slotSummaries`와 `participants.responses`를 제공, `availabilityRatio` 소수 둘째 자리 반올림 |
| VS-02 | 참여자 0명 | 참여자/응답 배열 빈 값 | `participantCount=0`, 모든 `availabilityRatio=0` |
| VS-03 | 템플릿 캐시 히트 | 캐시 `get` → 규칙 반환 | `TemplateRepository` 호출 없음, `template_cache_hit_ratio` 업데이트 플래그 true |
| VS-04 | 템플릿 캐시 미스 | 캐시 `get` → null, 레포지터리 규칙 반환 | `cache.set` 호출 1회, 이후 서비스 정상 진행 |
| VS-05 | 템플릿 미존재 | `TemplateRepository.findById` → null | `TemplateUnavailableError` throw |
| VS-06 | 약속 미존재 | `AppointmentRepository.findById` → null | `AppointmentNotFoundError` throw |
| VS-07 | 응답 정렬 유지 | 템플릿 슬롯 `[slotA, slotB, slotC]`, 응답 순서 뒤섞음 | `participants.responses`가 `[slotA, slotB, slotC]` 순서로 정렬 |
| VS-08 | 라운딩 정확도 | 총 3명 중 2명 선택 | `availabilityRatio=0.67` |

### 4.3 ViewAppointmentController 단위 테스트
| ID | 시나리오 | 설정 | 예상 결과 |
| --- | --- | --- | --- |
| VC-01 | 성공 응답 직렬화 | 서비스 mock → 정상 DTO | HTTP 200, 본문이 백엔드 계약 구조(4개 최상위 키)와 일치 |
| VC-02 | 약속 없음 | 서비스 mock → `AppointmentNotFoundError` throw | HTTP 404, 코드 `APPOINTMENT_NOT_FOUND`, 메시지 규칙 준수 |
| VC-03 | 템플릿 불가 | 서비스 mock → `TemplateUnavailableError` throw | HTTP 503, 코드 `SERVICE_UNAVAILABLE` |
| VC-04 | 기타 오류 | 서비스 mock → 일반 오류 throw | HTTP 500, 코드 `INTERNAL_ERROR`, `requestId` 헤더 유지 |
| VC-05 | Request ID 전파 | 요청 헤더 `x-request-id=abc123` | 응답 헤더 및 로그/메트릭에 동일 ID 포함 |
| VC-06 | Accept 헤더 무시 | `Accept: text/html` | JSON 응답 유지 |

### 4.4 라우터/Express 통합 테스트 (Supertest)
| ID | 시나리오 | 준비 데이터 | 예상 응답/검증 |
| --- | --- | --- | --- |
| IT-01 | 정상 조회 | 약속 1개, 템플릿 슬롯 3개, 참여자 2명/응답 삽입 | HTTP 200, 응답 JSON이 슬롯 순서/집계/라운딩 정확, `participantCount=2` |
| IT-02 | 약속 없음 | 해당 ID 레코드 미삽입 | HTTP 404, 오류 코드/메시지 확인 |
| IT-03 | 템플릿 누락 | 약속 존재하나 템플릿 레코드 삭제 | HTTP 503, 오류 응답 계약 일치 |
| IT-04 | 응답 없는 약속 | 참여자 없고 응답 없음 | `participants=[]`, `slotSummaries[].availableCount=0`, 라운딩 0 |
| IT-05 | 다중 슬롯 정렬 | 템플릿에 날짜 혼합/식사 타입 포함 | 응답 슬롯이 날짜 오름차순, 동일 날짜는 `BREAKFAST→LUNCH→DINNER` |
| IT-06 | 캐시 히트 검증 | 동일 약속 연속 2회 조회 | 두 번째 요청에서 템플릿 조회 쿼리가 발생하지 않음(Prisma mock/쿼리 로그 확인) |
| IT-07 | 캐시 만료 재로딩 | fake timer로 TTL 경과 후 재호출 | 재호출 시 템플릿 재조회 및 캐시 재적재 |
| IT-08 | Request ID 보존 | `x-request-id` 헤더 포함 요청 | 응답 헤더 동일 값, 로그 spy 확인 |
| IT-09 | DB 오류 처리 | Prisma mock → 연결 오류 throw | HTTP 503, 코드 `SERVICE_UNAVAILABLE`, 재시도 안내 메시지 |
| IT-10 | 예기치 않은 오류 | 서비스 더블이 throw | HTTP 500, 로거 error 레벨 호출 |

### 4.5 관측성/로깅 테스트
- 성공 흐름에서 `appointment.viewed` 로그가 `info` 레벨, 필드(`appointmentId`, `participantCount`, `slotCount`, `durationMs`)를 포함하는지 검증.
- 템플릿 캐시 미스 시 `template.cache.miss` debug 로그가 기록되는지 확인.
- 통합 테스트 중 `http_server_requests_total` 및 `appointment_view_duration_ms` 메트릭 증가를 단언하고, 캐시 히트/미스에 따라 `template_cache_hit_ratio` 업데이트가 호출되는지 확인.

### 4.6 회귀/계약 테스트
- 백엔드 응답 DTO를 JSON 스냅샷으로 저장하여 프런트엔드 계약이 변경되지 않았는지 감시한다.
- 날짜/식사 타입 정렬, `availabilityRatio` 라운딩, `participants.responses` 정렬이 스냅샷에 반영되도록 대표 데이터셋을 유지한다.

## 5. 비기능 테스트 고려사항
- 캐시/집계 로직은 CPU 연산만 수행하므로 단위 테스트에서 대량 슬롯(42개)과 참여자(200명) 데이터를 사용해 성능 회귀를 조기에 감지한다.
- 통합 테스트는 Jest `--runInBand`를 유지하고, DB 초기화는 `beforeEach`에서 빠른 `TRUNCATE` + `RESTART IDENTITY`를 사용한다.
- 템플릿 캐시 테스트는 병렬 실행 시 격리된 인스턴스를 사용하여 공유 상태 경합을 방지한다.

## 6. 커버리지 및 리포트
- 단위/통합 테스트 모두에서 커버리지를 수집하며, `ViewAppointmentService`와 `AvailabilityAggregator`의 분기 커버리지를 90% 이상 유지한다.
- CI에서는 `coverage/` 보고서를 업로드하여 `meal-appointment-view-appointment-backend-implementation-spec.md` 요구사항 준수 여부를 추적한다.

## 7. 관련 명세
- `agent/specs/meal-appointment-view-appointment-backend-spec.md`
- `agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md`
- `agent/specs/meal-appointment-view-appointment-user-spec.md`
- `agent/specs/meal-appointment-domain-spec.md`
- `agent/specs/meal-appointment-architecture-spec.md`
- `agent/specs/meal-appointment-local-testing-spec.md`
