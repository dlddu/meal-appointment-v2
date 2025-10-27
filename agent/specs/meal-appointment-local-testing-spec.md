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

## 6. E2E 테스트 (Playwright)
1. **전제 조건**
   - 로컬 PostgreSQL에서 E2E 전용 DB 준비:
     ```bash
     createdb meal_appointment_e2e
     ```
   - `api-server/.env.e2e`에 `DATABASE_URL`과 `PORT=4002`, `VITE_API_BASE_URL` 등 설정.
   - `web-client/.env.e2e`에 `VITE_API_BASE_URL=http://localhost:4002` 지정.
2. **데이터 시드**
   ```bash
   cd api-server
   npx prisma migrate deploy --schema prisma/schema.prisma --env-file .env.e2e
   npx prisma db seed --schema prisma/schema.prisma --env-file .env.e2e
   cd ..
   ```
   - 기본 시간 슬롯 템플릿을 삽입하여 테스트 시 UI가 슬롯을 렌더링할 수 있게 한다.
3. **서비스 기동**
   - 터미널 A: `cd api-server && npm run start:e2e` (`NODE_ENV=e2e`로 Express 서버 실행).
   - 터미널 B: `cd web-client && npm run dev -- --mode e2e --host localhost --port 5173` (E2E용 환경변수를 적용한 Vite 개발 서버 실행).
4. **Playwright 실행**
   ```bash
   cd web-client
   npx playwright install --with-deps
   npm run test:e2e
   ```
   - `playwright test --config playwright.e2e.config.ts`를 호출해 브라우저 자동화. 시나리오 예: 약속 생성 → 공유 링크 접속 → 참여자 응답 제출 → 요약 확인.
5. **테스트 후 정리**
   - 서버 프로세스를 종료하고, 필요 시 `dropdb meal_appointment_e2e`로 데이터베이스 삭제.

## 7. 문제 해결 가이드
- **포트 충돌**: API 서버(4000~4002), Vite(5173) 포트가 사용 중이면 `.env`의 포트를 변경하고 Playwright 설정도 동기화한다.
- **SSL 요구**: 로컬 테스트는 HTTP로 진행하며, 프록시/SSL 설정은 비활성화한다.
- **Prisma 캐시 이슈**: 스키마 변경 후 테스트 실패 시 `rm -rf node_modules/.cache/prisma` 후 `npx prisma generate` 재실행.
- **테스트 간 격리**: Jest 프로젝트 설정에서 `--runInBand`를 유지하거나 Prisma 테스트 클라이언트를 각 테스트마다 `beforeEach`에서 초기화한다.

## 8. 참조 명세
- 본 테스트 명세는 다음을 기반으로 작성되었다.
  - `agent/specs/meal-appointment-domain-spec.md`
  - `agent/specs/meal-appointment-architecture-spec.md`
