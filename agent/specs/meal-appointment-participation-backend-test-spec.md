# 식사 약속 참여 백엔드 테스트 명세

## 1. 목적과 범위
- 본 테스트 명세는 `POST /api/appointments/{appointmentId}/participants`와 `PUT /api/appointments/{appointmentId}/participants/{participantId}/responses` 구현(참조: `meal-appointment-participation-backend-implementation-spec.md`)을 검증하기 위한 자동화 테스트 전략과 시나리오를 정의한다.
- 검증 대상은 Express 라우팅, 입력 검증 미들웨어, 서비스 계층, Prisma 레포지터리, 가용성 집계 서비스, 로깅/메트릭을 포함한 백엔드 전 영역이다.
- 약속 생성/조회, 프런트엔드 연동, 알림·확정 등의 부가 기능은 범위에서 제외한다.

## 2. 테스트 환경 전제
- 테스트 실행 전 `api-server` 워크스페이스에서 `npm install`, `npx prisma generate` 수행.
- 통합 테스트에서는 PostgreSQL 15 이상을 사용하며, 테스트 DB(`meal_appointment_test`)에 마이그레이션 적용 후 각 테스트 케이스마다 트랜잭션 롤백 또는 테이블 truncate로 격리한다.
- `.env.test` 환경 파일을 사용하고, Pino 로거는 transport mock 또는 캡처 스트림으로 대체한다.
- `TimeSlotTemplateService`와 캐시가 주입 가능하도록 인터페이스를 mock/stub할 수 있어야 하며, 필요 시 템플릿 캐시 TTL(5분)을 단축하거나 수동 무효화한다.

## 3. 테스트 계층별 전략
### 3.1 단위 테스트 (Jest, runInBand)
- **대상 모듈**: 입력 검증 스키마, PIN 해시 유틸, 슬롯 키 검증 헬퍼, 서비스 계층 내부 분기.
- **목표**: 외부 I/O 없이 순수 로직과 분기 검증. Prisma, Pino, 캐시/템플릿 서비스는 mock/stub 사용.
- **설정**: `jest --selectProjects unit`, 각 테스트 후 mock reset 및 fake timer 정리.

### 3.2 통합 테스트 (Jest + Supertest)
- **대상 모듈**: Express 라우터 ↔ 서비스 ↔ Prisma ↔ PostgreSQL.
- **목표**: 실제 HTTP 요청으로 계약(상태 코드, 오류 코드, 응답 직렬화, 집계 요약)을 검증한다.
- **설정**: `jest --selectProjects integration`, 요청 ID/로깅/메트릭 캡처 포함, 테스트 간 DB 격리 유지.

### 3.3 관측성/로깅 검증
- **대상 모듈**: Pino 로거, 메트릭 emitter.
- **목표**: 성공/실패 시 이벤트 로그와 메트릭 필드가 명세와 일치하는지 확인한다.
- **설정**: 로거 transport를 test double로 교체, 메트릭 레지스트리 초기화 후 증가량 검증.

## 4. 테스트 시나리오 상세
### 4.1 입력 검증 미들웨어 단위 테스트
| ID | 시나리오 | 절차 | 예상 결과 |
| --- | --- | --- | --- |
| UV-01 | 닉네임 trimming | 앞뒤 공백 포함 닉네임으로 validate 호출 | 반환 DTO에서 공백 제거 후 길이 규칙 만족 |
| UV-02 | 닉네임 길이 0 | 빈 문자열 닉네임 | `VALIDATION_ERROR`, field=`nickname` |
| UV-03 | 닉네임 길이 31 | 31자 문자열 | `VALIDATION_ERROR`, message에 길이 제한 명시 |
| UV-04 | PIN 미제공 | `pin` 누락 | DTO에서 `undefined` 유지, 에러 없음 |
| UV-05 | PIN 길이 3 | 3자 PIN | `VALIDATION_ERROR`, field=`pin` |
| UV-06 | PIN 길이 13 | 13자 PIN | `VALIDATION_ERROR`, field=`pin` |
| UV-07 | 슬롯 배열 중복 | `availableSlots`에 중복 키 포함 | `VALIDATION_ERROR`, 중복 메시지 반환 |
| UV-08 | 슬롯 형식 불일치 | `20240305#LUNCH` 등 포맷 위반 | `INVALID_SLOT` 또는 `VALIDATION_ERROR` 반환 |
| UV-09 | 잘못된 템플릿 키 | 템플릿 서비스가 허용하지 않는 슬롯 | `INVALID_SLOT`, 오류 배열에 슬롯 명시 |

### 4.2 참가자 생성/재사용 서비스 단위 테스트
| ID | 시나리오 | 의존성 세팅 | 예상 결과 |
| --- | --- | --- | --- |
| PS-01 | 신규 참가자 생성 | `AppointmentRepository.findById` → 약속 존재, `ParticipantRepository.findByAppointmentAndNickname` → 없음 | PIN 해시 함수 호출, `submittedAt=null`, 빈 `responses` 포함 응답 |
| PS-02 | 기존 참가자 PIN 일치 | 기존 참가자 반환, PIN 해시 검증 성공 | 200 응답 DTO 반환, `hasPin=true`, `submittedAt` 유지 |
| PS-03 | 기존 참가자 PIN 불일치 | PIN 해시 검증 실패 | `INVALID_PIN` 예외/HTTP 403, 로거 warn |
| PS-04 | 기존 참가자 PIN 미설정 | 저장된 PIN 없음, 입력 PIN 제공 | PIN 검증 없이 기존 정보 반환, `hasPin=false` |
| PS-05 | 약속 없음 | `AppointmentRepository.findById` → null | `APPOINTMENT_NOT_FOUND` 예외/HTTP 404 |
| PS-06 | 닉네임 충돌 | 레포지터리가 닉네임 중복 예외 throw | `NICKNAME_TAKEN` 매핑, HTTP 409 |
| PS-07 | 로깅 필드 | Logger mock | `participant.joined` info 로그에 appointmentId, nickname 포함 |

### 4.3 가용성 제출/수정 서비스 단위 테스트
| ID | 시나리오 | 의존성 세팅 | 예상 결과 |
| --- | --- | --- | --- |
| RS-01 | 정상 업데이트 | 템플릿 서비스가 두 슬롯 허용, 기존 응답 삭제 후 새 응답 insert mock | `submittedAt` 갱신, `selected` 배열이 입력과 동일, 집계 서비스 호출 1회 |
| RS-02 | 참가자 닉네임 불일치 | 경로 participantId는 존재하나 다른 닉네임 | `PARTICIPANT_MISMATCH`/HTTP 403 |
| RS-03 | PIN 검증 실패 | 참가자에 PIN 저장, 해시 검증 실패 | `INVALID_PIN`/HTTP 403 |
| RS-04 | 슬롯 중복 제거 | 중복 포함 입력 | 저장 시 중복 제거된 개수로 insert 호출 |
| RS-05 | 슬롯 검증 실패 | 템플릿 검증 헬퍼가 false 반환 | `INVALID_SLOT`/HTTP 400, 실패 슬롯 명시 |
| RS-06 | 트랜잭션 롤백 | insert 중 예외 throw | 기존 응답 유지, 예외 재throw, DB 호출 수 검증 |
| RS-07 | 집계 포함 응답 | 집계 서비스가 participantCount/slotSummaries 반환 | 응답 DTO에 summary 포함, logger debug에 집계 데이터 기록 |

### 4.4 캐시/템플릿 연동 단위 테스트
- 템플릿 캐시 히트 시 `TimeSlotTemplateService` 로드 호출이 생략되는지 확인.
- 캐시 미스 후 로드 시 캐시에 set 호출이 수행되고, 슬롯 검증 헬퍼가 로드된 템플릿 규칙을 사용해 유효성을 판단하는지 확인.
- 캐시 TTL 단축 환경에서 expire 이후 재호출 시 템플릿이 다시 로드되는지 fake timer로 검증.

### 4.5 Express 라우터 통합 테스트 (Supertest)
| ID | 시나리오 | 요청 | 예상 응답/검증 |
| --- | --- | --- | --- |
| IT-01 | 신규 참가자 생성 | `POST /appointments/{id}/participants` JSON: `{ nickname, pin }` | `200`, 응답에 `participantId`, `hasPin`, `submittedAt=null`, DB에 참가자/빈 slot_availabilities 레코드 |
| IT-02 | 기존 참가자 재사용 | 동일 닉네임 재요청 + PIN 일치 | `200`, 같은 `participantId`, `submittedAt` 보존 |
| IT-03 | 기존 참가자 PIN 불일치 | 잘못된 PIN | `403`, 코드 `INVALID_PIN`, DB 변경 없음 |
| IT-04 | 닉네임 중복 충돌 | 동일 약속에 다른 사용자가 동일 닉네임 제출 | `409`, 코드 `NICKNAME_TAKEN`, 로그 warn |
| IT-05 | 약속 없음 | 존재하지 않는 appointmentId | `404`, 코드 `APPOINTMENT_NOT_FOUND` |
| IT-06 | 가용성 정상 제출 | `PUT /participants/{pid}/responses` JSON: `{ nickname, pin?, availableSlots }` | `200`, `selected`에 저장 슬롯 배열, `summary`에 집계 값, DB에 슬롯 수만큼 insert |
| IT-07 | 슬롯 검증 실패 | 템플릿에 없는 슬롯 포함 | `400`, 코드 `INVALID_SLOT`, 실패 슬롯 반영 |
| IT-08 | 닉네임 불일치 | participantId는 존재, 다른 nickname | `403`, 코드 `PARTICIPANT_MISMATCH` |
| IT-09 | PIN 미제공 및 불필요 | 참가자가 PIN 미설정 상태 | `200`, PIN 없이 성공 |
| IT-10 | PIN 필요한 요청 | 참가자가 PIN 설정 상태, PIN 누락 | `403`, 코드 `INVALID_PIN` |
| IT-11 | 집계 응답 포맷 | 정상 제출 후 summary 구조 확인 | `participantCount` 증가, `availabilityRatio` 소수점 포함 |
| IT-12 | 요청 ID 전파 | 헤더 `x-request-id` 포함 | 응답 및 로그에 동일 ID 포함 |
| IT-13 | 로깅/메트릭 | 정상 요청 후 logger/metrics spy 확인 | `participant.joined` 및 `participant.responses.submitted` info 로그 1회씩, 메트릭 증가 |
| IT-14 | DB 장애 처리 | Prisma 예외 stub | `500` 또는 `503`으로 매핑, `INTERNAL_ERROR` 코드, 트랜잭션 롤백 확인 |

### 4.6 데이터 무결성 확인
- `participants` 레코드에 닉네임이 트리밍되어 저장되는지 확인하고, PIN 해시가 평문이 아닌지 검사한다.
- `slot_availabilities`에 템플릿에서 허용한 슬롯 키만 저장되는지, 중복 없이 participant별로 연결되는지 Prisma 쿼리로 확인한다.
- 응답 제출 후 `submitted_at` 타임스탬프가 ISO 문자열로 직렬화되며 UTC 기준임을 검증한다.

## 5. 비기능 테스트 고려사항
- 테스트 실행 시간을 단축하기 위해 통합 테스트는 `--runInBand`를 유지하고, beforeEach에서 주요 테이블 truncate로 격리한다.
- 로깅/메트릭 검증 시 실제 외부 시스템에 의존하지 않고 in-memory collector를 사용한다.
- 병렬 실행 시 템플릿 캐시 스토어와 Prisma 연결을 테스트별 인스턴스로 분리하거나 mutex로 보호한다.

## 6. 커버리지 및 리포트
- 단위/통합 테스트 모두에서 커버리지를 수집하며, 서비스 계층과 검증 미들웨어 분기 커버리지를 90% 이상 유지한다.
- CI에서 `coverage/` 디렉터리를 수집하여 `meal-appointment-participation-backend-implementation-spec.md` 요구사항 충족 여부를 추적한다.

## 7. 관련 명세
- `agent/specs/meal-appointment-participation-backend-implementation-spec.md`
- `agent/specs/meal-appointment-participation-user-spec.md`
- `agent/specs/meal-appointment-architecture-spec.md`
- `agent/specs/meal-appointment-domain-spec.md`
- `agent/specs/meal-appointment-local-testing-spec.md`
