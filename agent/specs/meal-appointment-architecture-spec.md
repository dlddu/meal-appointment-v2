# 식사 약속 조율 소프트웨어 아키텍처 명세

## 1. 목적과 범위
- 본 명세는 `agent/specs/meal-appointment-domain-spec.md`에서 정의한 도메인 요구사항을 만족하는 최소 기능 웹 애플리케이션의 아키텍처를 제시한다.
- 로그인이나 고급 보안 기능 없이 닉네임 기반으로 약속 생성과 참여가 가능한 경량 시스템을 전제로 한다.

## 2. 전체 구조 개요
- **아키텍처 스타일**: 단일 페이지 애플리케이션(SPA) + RESTful 백엔드 + 단일 관계형 데이터베이스.
- **배포 단위**:
  1. `web-client`: React 기반 정적 파일을 제공하는 프런트엔드.
  2. `api-server`: Node.js/Express 기반 REST API.
  3. `postgres-db`: PostgreSQL 15 컨테이너.
- **통신 경로**: 웹 클라이언트는 HTTPS를 통해 API 서버와만 통신하며, API 서버가 데이터베이스와 직접 상호작용한다.

## 3. 기술 스택 명세
| 계층 | 기술 | 선택 이유 |
| --- | --- | --- |
| 프런트엔드 | React 18 + Vite + TypeScript + Tailwind CSS | 빠른 개발, 반응형 UI, 타입 안정성, CSS 유틸리티 기반 레이아웃 |
| 상태 관리 | React Query | 서버 상태 동기화와 캐싱을 단순화 |
| 백엔드 | Node.js 20 + Express 4 + TypeScript | 경량 REST API 구현에 적합, 널리 사용되는 생태계 |
| 데이터베이스 | PostgreSQL 15 | 관계형 모델과 JSON 컬럼을 모두 지원하여 템플릿 규칙 저장이 용이 |
| ORM/쿼리 | Prisma ORM | 스키마 관리 자동화와 타입 안전 제공 |
| 배포/운영 | Docker Compose | 3개 컴포넌트를 단일 스택으로 로컬 및 프로덕션에 배포 |
| 테스트 | Vitest(프런트), Jest + Supertest(백엔드) | 단위/통합 테스트 지원 |

## 4. 주요 컴포넌트 설계
### 4.1 Web Client
- **역할**: 약속 생성, 공유 링크 접속, 슬롯 가용성 입력 UI 제공.
- **주요 모듈**:
  - `CreateAppointmentPage`: 제목/설명 입력과 템플릿 선택 폼.
  - `AppointmentDashboard`: 템플릿 기반 슬롯 리스트와 참여 현황 표시.
  - `ParticipantSessionForm`: 닉네임 및 선택적 PIN 입력.
  - `AvailabilityMatrix`: 슬롯별 체크 UI와 요약 패널.
- **데이터 흐름**: React Query를 사용해 `/appointments`, `/appointments/{id}`, `/appointments/{id}/availability` API를 호출하고 응답을 캐싱한다.
- **반응형 전략**: Tailwind CSS breakpoints(`sm`, `md`, `lg`)로 카드형 레이아웃을 구성하며 모바일 기준으로 우선 설계한다.

### 4.2 API Server
- **엔드포인트** (REST):
  - `POST /appointments`: 제목, 설명, 템플릿 ID를 받아 약속 생성.
  - `GET /appointments/{appointmentId}`: 약속 상세와 템플릿 메타데이터 반환.
  - `GET /appointments/{appointmentId}/slots`: 템플릿 규칙을 적용해 동적으로 생성한 슬롯 리스트 반환.
  - `POST /appointments/{appointmentId}/participants`: 닉네임(+선택적 PIN)으로 참여자 세션 생성.
  - `PUT /appointments/{appointmentId}/participants/{participantId}/availability`: 슬롯 가용성 제출 또는 수정.
  - `GET /appointments/{appointmentId}/availability-summary`: 슬롯별 총 가용 인원, 응답률 제공.
- **레이어 구조**:
  - `Presentation`: Express 라우터.
  - `Application`: 서비스 클래스가 도메인 규칙 적용 및 트랜잭션 조정.
  - `Domain`: 템플릿 규칙 평가, 닉네임 중복 검사, 가용성 계산.
  - `Infrastructure`: Prisma 리포지토리, PostgreSQL 연결.
- **템플릿 엔진**: 규칙 기반 슬롯 생성 모듈(`TemplateEngine`)을 분리하여 템플릿 확장을 용이하게 한다.

### 4.3 데이터베이스 스키마
- **테이블**:
  - `appointments(id, title, summary, time_slot_template_id, created_at)`
  - `time_slot_templates(id, name, description, ruleset_json)`
  - `participants(id, appointment_id, nickname, optional_pin_hash, created_at)`
  - `slot_availability(appointment_id, slot_instance_id, participant_id, is_available, submitted_at)`
- `slot_instance_id`는 템플릿 규칙에서 파생된 식별자(예: `2024-05-14_dinner`)를 문자열로 저장하여 실제 슬롯 엔터티 없이 가용성 응답을 연결한다.
- 닉네임 고유성은 `(appointment_id, nickname)` 유니크 인덱스로 보장한다.

## 5. 데이터 및 제어 흐름
1. 생성자: Web Client → `POST /appointments` → DB `appointments` 저장.
2. 참여자: 공유 URL 접속 → `GET /appointments/{id}`와 `/slots` 호출 → TemplateEngine이 규칙(`ruleset_json`)을 해석하여 슬롯 목록 생성.
3. 참여자 세션 생성: `POST /participants` → 닉네임 중복 검사 후 레코드 저장(선택적 PIN은 Argon2 해시).
4. 가용성 제출: UI에서 선택한 슬롯을 배열로 전송 → 서비스가 기존 응답을 삭제 후 일괄 upsert → 집계 쿼리로 응답률 계산.

## 6. 비기능 고려 사항
- **성능**: 슬롯 목록은 규칙 기반으로 즉시 계산하며, appointment별 캐시(메모리 5분 TTL)를 두어 반복 요청을 완화한다.
- **확장성**: Docker Compose 기반 초기 배포 후, 필요 시 API 서버와 DB를 각각 컨테이너 오토스케일링이 가능한 환경(Kubernetes 등)으로 이전할 수 있다.
- **보안**: HTTPS 강제, 선택적 PIN은 Argon2로 해시 저장, Rate Limiting(Express-rate-limit) 적용.
- **관측성**: pino 로깅, Prometheus exporter를 통한 요청/슬롯 생성 지표 수집.

## 7. 배포 및 운영 파이프라인
- GitHub Actions에서 다음 파이프라인을 구성한다.
  1. `npm run lint` / `npm run test` (웹, API 각각 workspace 분리 운영).
  2. Docker 이미지 빌드(`web-client`, `api-server`).
  3. main 브랜치 병합 시 컨테이너 레지스트리에 푸시 후 스테이징 서버에 `docker compose pull && up -d` 실행.
- 환경 변수 관리: `.env` 템플릿 제공, 실제 비밀 값은 Vault 또는 GitHub Actions Secrets를 사용한다.

## 8. 향후 확장 포인트
- 시간 슬롯 템플릿 다중화 시 TemplateEngine에 신규 패턴 클래스를 추가한다.
- 실시간 업데이트가 필요할 경우 API 서버에 WebSocket 게이트웨이 모듈을 추가하고, React Query의 `onFocus` 리프레시로 초기 대응한다.
- 통계나 보고 기능 확장 시 별도 `analytics` 모듈을 API 서버에 추가하고 Materialized View로 응답 집계를 최적화한다.
