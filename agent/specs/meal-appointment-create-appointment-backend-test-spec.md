# 식사 약속 생성 백엔드 테스트 명세

## 1. 목적 및 범위
- 본 문서는 `POST /appointments` 식사 약속 생성 기능의 백엔드 테스트 전략과 케이스를 정의한다.
- 테스트 대상은 Express HTTP 계층, 서비스 로직, Prisma 기반 영속화, 캐시, 관측 가능성 컴포넌트이다.
- 프런트엔드 렌더링, 인프라 구성(CORS, 레이트 리밋)은 범위에서 제외한다.

## 2. 테스트 환경 및 공통 설정
- Node.js LTS (v20.x) + TypeScript 컴파일 환경.
- 테스트 러너: Jest + ts-jest 구성.
- HTTP 통합 테스트: Supertest 사용, in-memory PostgreSQL (pg-mem) 또는 테스트 컨테이너 기반 실 DB 사용.
- Prisma: 테스트 전 `prisma migrate deploy --schema prisma/schema.prisma` 수행 후, 각 케이스마다 트랜잭션 롤백 또는 DB 재시드.
- 로그 캡처: pino-http 로거를 `pino.transport({ target: 'pino/file', options: { destination: 1 } })` 또는 커스텀 스트림으로 주입하여 단언한다.
- 메트릭 수집: Prometheus 레지스트리를 테스트마다 초기화하여 카운터 값 검증.
- 캐시 무효화: `TimeSlotTemplateCatalog`의 캐시 인스턴스를 테스트마다 초기화하거나 TTL을 강제로 만료시킨다.

## 3. 단위 테스트
### 3.1 입력 검증 (`createAppointmentSchema`)
| ID | 시나리오 | 입력 | 기대 결과 |
| --- | --- | --- | --- |
| U1 | 정상 입력 | `{ title: '점심 약속', summary: '함께해요', timeSlotTemplateId: 'default_weekly' }` | 검증 성공, 정제된 값 반환(앞뒤 공백 제거). |
| U2 | 제목 공백 제거 | `{ title: '  회의  ', summary: '', timeSlotTemplateId: 'default_weekly' }` | `title`이 `회의`로 정제. |
| U3 | 제목 길이 초과 | 61자 문자열 | `ValidationError` 발생, 메시지 `제목은 1~60자여야 합니다.` |
| U4 | 요약 길이 초과 | `summary`가 201자 | `ValidationError` 발생, 메시지 `요약은 0~200자여야 합니다.` |
| U5 | 템플릿 누락 | `timeSlotTemplateId` 미포함 | `ValidationError` 발생, `details`에 템플릿 필드. |

### 3.2 템플릿 카탈로그 (`TimeSlotTemplateCatalog`)
| ID | 시나리오 | 설정 | 기대 결과 |
| --- | --- | --- | --- |
| U6 | 캐시 미스 | 캐시 비어있는 상태에서 `getActiveTemplates()` 호출 | 상수 소스 로드 후 캐시에 저장. |
| U7 | 캐시 히트 | TTL 내 재호출 | 소스 미호출, 캐시 결과 반환. |
| U8 | TTL 만료 | TTL을 조작해 만료 후 호출 | 소스 재호출 및 캐시 갱신. |
| U9 | 존재하지 않는 템플릿 검증 | `create` 서비스가 미등록 템플릿 사용 | `ValidationError` 발생. |

### 3.3 서비스 로직 (`create`)
| ID | 시나리오 | 사전 조건 | 기대 결과 |
| --- | --- | --- | --- |
| U10 | 성공 경로 | 활성 템플릿 존재 | Prisma 트랜잭션 내 `AppointmentRepository.create` 호출, 반환 DTO에 상대 경로 포함. |
| U11 | 트랜잭션 롤백 | `AppointmentRepository.create`에서 예외 | Prisma가 롤백 호출, `SERVICE_UNAVAILABLE` 변환. |
| U12 | 로그 및 메트릭 | 성공 호출 | `appointment.created` 로그, `appointments_created_total{template_id="default_weekly",result="success"}` 증가. |
| U13 | 검증 오류 변환 | 템플릿 미존재 | `ValidationError` → `VALIDATION_ERROR` 코드로 변환. |

### 3.4 공유 URL 빌더 (`ShareUrlBuilder`)
- 입력: `appointmentId = '123e4567-e89b-12d3-a456-426614174000'`
- 기대: `/appointments/123e4567-e89b-12d3-a456-426614174000` 반환, 절대 URL 구성 없음.

## 4. HTTP 통합 테스트
### 4.1 성공 케이스
| ID | 설명 | 요청 | 기대 |
| --- | --- | --- | --- |
| I1 | 기본 성공 | POST `/appointments`<br>`{ "title": "점심", "summary": "회의", "timeSlotTemplateId": "default_weekly" }` | 201 응답, 응답 본문이 명세 §2.2와 일치, DB에 레코드 생성, 로그 및 메트릭 증가. |
| I2 | 요약 미제공 | `summary` 누락 | 응답의 `summary`가 빈 문자열, DB에도 빈 문자열 저장. |
| I3 | 제목 공백 | 제목 앞뒤 공백 포함 | 응답에 정제된 제목 반환. |

### 4.2 검증 실패
| ID | 설명 | 요청 | 기대 |
| --- | --- | --- | --- |
| I4 | 제목 없음 | `title` 누락 | 400 응답, `code=VALIDATION_ERROR`, `details`에 `title`. |
| I5 | 제목 길이 초과 | 61자 제목 | 400 응답, 메시지 "입력값을 다시 확인하세요.". |
| I6 | 템플릿 미등록 | `timeSlotTemplateId: "unknown"` | 400 응답, `details`에 템플릿 메시지. |

### 4.3 장애 시나리오
| ID | 설명 | 장애 주입 | 기대 |
| --- | --- | --- | --- |
| I7 | DB 연결 실패 | Prisma 클라이언트 강제 종료 | 503 응답, `code=SERVICE_UNAVAILABLE`, 메트릭 `result="service_unavailable"`. |
| I8 | 예기치 못한 예외 | 서비스 내 일반 오류 throw | 500 응답, `code=INTERNAL_SERVER_ERROR`, 로그에 스택 추적 포함. |

## 5. 관측 가능성 검증
- 로그 테스트: 요청마다 `requestId`가 로그에 포함되는지, 본문이 200자 이내로 잘린 문자열인지 확인.
- 메트릭 테스트: `/metrics` 엔드포인트 호출 시 `appointments_created_total`에 성공/실패 레이블이 노출되는지 확인.
- 카운터 초기화 후 테스트 케이스별 기대 레이블/값 검증.

## 6. 보안 및 비기능 확인
- SQL 인젝션 방지: 특수문자 포함 제목/요약으로 요청 후 DB 레코드 값이 그대로 저장되고 에러가 없는지 확인.
- 동시성: 동일한 템플릿으로 10개 동시 요청 시 모두 201 응답이며 레이스 컨디션이 없음을 확인.
- 캐시 일관성: 템플릿 목록 갱신 시 캐시 TTL 만료 후 새 템플릿 반영되는지 통합 테스트 작성.

## 7. 테스트 데이터 및 픽스처 관리
- 공통 픽스처: 활성 템플릿 `default_weekly`.
- 각 테스트 종료 후 DB 테이블 `appointments` 비우기.
- 로그/메트릭 캡처 스트림은 테스트 종료 후 리셋하여 케이스 간 간섭 방지.

## 8. 연계 명세
- 본 테스트 명세는 `meal-appointment-create-appointment-backend-spec.md`에서 정의한 계약을 검증한다.
- 사용자 흐름 요구사항(`meal-appointment-create-appointment-user-spec.md`)과 응답 스키마 일치 여부를 통합 테스트에서 점검한다.
- UI/UX 명세의 필드명(`meal-appointment-create-appointment-uiux-spec.md`)이 응답과 일치하는지 확인한다.
