# 식사 약속 조율 로컬 테스트 실행 명세

## 1. 목적
- 도메인 및 아키텍처 명세를 구현한 모노레포(프런트엔드 `web-client`, 백엔드 `api-server`)에서 Docker 없이 로컬 환경에서 테스트를 실행하는 표준 절차를 정의한다.
- 단위 테스트, 통합 테스트, E2E 테스트를 분리해 필요한 선행 조건과 실행 명령, 데이터베이스 준비 과정을 명확히 한다.

## 2. 공통 사전 준비
1. **필수 도구 설치**
   - Node.js 20.x (npm 9 이상 포함)
   - PostgreSQL 15 (서버 및 `psql` CLI)
   - pnpm을 사용하지 않는 경우라도 npm workspaces 지원이 필요하므로 npm 기본 사용을 권장한다.
2. **의존성 설치**
   ```bash
   npm install
   ```
   - 루트 `package.json`에서 워크스페이스(`web-client`, `api-server`)를 감지해 각 패키지 의존성을 자동 설치한다.
3. **환경 변수 템플릿 복사**
   - `api-server/.env.example` → `.env.local`, `.env.test`, `.env.e2e` 등으로 복사하여 다음 핵심 값을 채운다.
     ```env
     DATABASE_URL=postgresql://postgres:postgres@localhost:5432/meal_appointment
     PORT=4000
     ```
   - 테스트 전용 데이터베이스를 위해 `DATABASE_URL`에 서로 다른 DB 이름을 부여한다. (예: `meal_appointment_test`, `meal_appointment_e2e`).
4. **Prisma 준비**
   ```bash
   cd api-server
   npx prisma generate
   cd ..
   ```
   - 스키마 변경 시마다 재실행한다.

## 3. 프런트엔드 단위 테스트 (Vitest)
1. 워크스페이스 진입: `cd web-client`.
2. 필요한 경우 환경 변수 로딩을 위해 `VITE_API_BASE_URL`을 `.env.test`에 설정한다. (예: `http://localhost:4000`).
3. 실행 명령:
   ```bash
   npm run test:unit
   ```
   - `vitest run`을 호출하도록 스크립트를 구성한다.
   - 기본적으로 DOM 가상화(`@testing-library/react`)와 React Query 캐시 테스트를 포함한다.
4. 옵션:
   - 특정 파일만 실행하려면 `npm run test:unit -- src/components/AvailabilityMatrix.test.tsx`.
   - 워치 모드는 `npm run test:unit -- --watch`.

## 4. 백엔드 단위 테스트 (Jest)
1. `cd api-server`.
2. DB 접근이 없는 순수 서비스/도메인 단위 테스트이므로 `.env.test`에서 `DATABASE_URL` 미설정 또는 메모리 DB URL을 사용해도 무방하다.
3. 실행 명령:
   ```bash
   npm run test:unit
   ```
   - `jest --runInBand --selectProjects unit` 형태로 구성하여 TemplateEngine, 닉네임 중복 검사 등 도메인 로직을 검증한다.
4. 커버리지 리포트가 필요하면 `npm run test:unit -- --coverage`.

## 5. 백엔드 통합 테스트 (Jest + Supertest)
1. **PostgreSQL 준비**
   - 로컬 PostgreSQL에서 테스트 전용 데이터베이스 생성:
     ```bash
     createdb meal_appointment_test
     ```
   - 필요 시 `psql -c "CREATE ROLE meal_user WITH LOGIN PASSWORD 'meal_pass';"` 등 별도 계정 생성.
2. **환경 변수 설정**
   - `api-server/.env.test`에 다음과 같이 설정:
     ```env
     DATABASE_URL=postgresql://meal_user:meal_pass@localhost:5432/meal_appointment_test?schema=public
     PORT=4001
     NODE_ENV=test
     ```
3. **마이그레이션 적용**
   ```bash
   cd api-server
   npx prisma migrate deploy --schema prisma/schema.prisma
   ```
   - 통합 테스트 전에 스키마 동기화. 필요 시 초기 템플릿 데이터를 `prisma db seed --schema prisma/schema.prisma`로 삽입한다.
4. **테스트 실행**
   ```bash
   npm run test:integration
   ```
   - `jest --runInBand --selectProjects integration` 스크립트를 호출하고, Supertest를 통해 Express 라우터와 Prisma 레이어를 실제 DB와 함께 검증한다.
5. **정리**
   - 테스트 완료 후 데이터를 초기화하려면 `psql meal_appointment_test -c 'TRUNCATE TABLE slot_availability, participants, appointments RESTART IDENTITY CASCADE;'` 실행.

## 6. E2E 테스트 (Playwright + kind)
E2E 단계는 로컬 프로세스가 아니라 [`kind`](https://kind.sigs.k8s.io/)로 띄운 단일 노드 Kubernetes 클러스터 위에서 컨테이너 이미지를 배포한 뒤 Playwright를 실행한다. 이렇게 하면 실제 컨테이너 빌드와 매니페스트가 검증되며, 운영에 가까운 환경에서 시나리오를 재현할 수 있다.

1. **전제 조건**
   - Docker 25 이상 (containerd 또는 docker 호환 데몬)
   - [`kind`](https://kind.sigs.k8s.io/) 0.24 이상
   - `kubectl` 1.30 이상
   - Playwright 브라우저 (`npx playwright install --with-deps chromium`)
   - 호스트 포트 `5173`(웹), `4002`(API)는 다른 프로세스에서 사용 중이지 않아야 한다. 이 두 포트는 `k8s/e2e/kind-config.yaml`의 `extraPortMappings`을 통해 클러스터 내 NodePort 30173/30400과 매핑된다.
2. **클러스터 매니페스트 구성**
   - `k8s/e2e/kind-config.yaml` – kind 클러스터 정의(포트 매핑 포함).
   - `k8s/e2e/namespace.yaml` – `meal-appointment-e2e` 네임스페이스.
   - `k8s/e2e/deployment.yaml` – api-server + web-client 컨테이너를 포함한 Deployment. 시작 시 `npx tsx scripts/migrate.ts` 실행 후 `node dist/prisma/seed.js`로 기본 템플릿을 시드한다.
   - `k8s/e2e/service.yaml` – api(NodePort 30400)/web(NodePort 30173)을 노출하는 Service.
3. **이미지 빌드와 배포**
   - 루트에서 `npm run test:web:e2e`를 실행하면 `scripts/run-tests.sh e2e`가 호출되고, 이는 다시 `scripts/e2e-kind.sh up`을 실행한다.
   - `scripts/e2e-kind.sh up`은 다음 작업을 수행한다.
     1. `meal-appointment-api:e2e` 이미지를 `api-server/Dockerfile`로 빌드.
     2. `meal-appointment-web:e2e` 이미지를 `web-client/Dockerfile`로 빌드. Playwright가 호스트에서 직접 API에 접근할 수 있도록 `VITE_API_BASE_URL=http://127.0.0.1:4002/api`를 빌드 인자로 주입한다.
     3. kind 클러스터(`meal-appointment-e2e`)가 없으면 생성하고, 빌드한 이미지를 `kind load docker-image`로 적재.
     4. `k8s/e2e/`의 매니페스트를 적용하고 `kubectl rollout status`로 준비 완료를 대기.
     5. 호스트 포트 5173/4002에 HTTP 응답이 올 때까지 대기.
4. **Playwright 실행**
   ```bash
   cd web-client
   E2E_USE_KIND=1 npm run test:e2e
   ```
   - `playwright.e2e.config.ts`는 `E2E_USE_KIND=1`이 설정되면 로컬 webServer 블록을 비활성화하고 kind가 노출하는 엔드포인트를 그대로 사용한다.
   - `scripts/run-tests.sh e2e`가 자동으로 이 환경 변수를 설정한다.
5. **테스트 후 정리**
   - 기본적으로 `scripts/run-tests.sh e2e`는 테스트 종료 후 `scripts/e2e-kind.sh down`을 호출해 kind 클러스터를 삭제한다.
   - 디버깅을 위해 클러스터를 유지하려면 `KEEP_CLUSTER=1 npm run test:web:e2e`를 사용한다. 이후 `scripts/e2e-kind.sh down`으로 수동 제거할 수 있다.
   - 실패 분석에는 `scripts/e2e-kind.sh logs`로 컨테이너 로그를 확인한다.

## 7. 문제 해결 가이드
- **포트 충돌**: API 서버(4000~4002), Vite(5173) 포트가 사용 중이면 `.env`의 포트를 변경하고 Playwright 설정도 동기화한다. kind 기반 E2E의 경우 `k8s/e2e/kind-config.yaml`의 `extraPortMappings`도 함께 수정한다.
- **SSL 요구**: 로컬 테스트는 HTTP로 진행하며, 프록시/SSL 설정은 비활성화한다.
- **kind 이미지 미반영**: `scripts/e2e-kind.sh up`은 매번 이미지를 재빌드해 `kind load docker-image`로 적재하고 Deployment를 `rollout restart`한다. 그래도 변경 사항이 반영되지 않으면 `scripts/e2e-kind.sh down`으로 클러스터를 초기화한다.
- **테스트 간 격리**: Jest 프로젝트 설정에서 `--runInBand`를 유지한다. E2E의 경우 Deployment 볼륨이 `emptyDir`이라 Pod이 재생성될 때마다 SQLite DB가 새로 시드된다.

## 8. 참조 명세
- 본 테스트 명세는 다음을 기반으로 작성되었다.
  - `agent/specs/meal-appointment-domain-spec.md`
  - `agent/specs/meal-appointment-architecture-spec.md`
