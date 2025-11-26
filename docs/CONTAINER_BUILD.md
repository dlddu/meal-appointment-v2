# Container Image Build

이 저장소에는 API 서버와 웹 클라이언트를 위한 컨테이너 이미지 빌드 워크플로우가 포함되어 있습니다.

## 개요

GitHub Actions를 사용하여 다음 두 개의 컨테이너 이미지를 자동으로 빌드하고 GitHub Container Registry(ghcr.io)에 푸시합니다:

1. **API Server** (`ghcr.io/dlddu/meal-appointment-v2/api-server`)
   - Node.js 20 Alpine 기반
   - Express 백엔드 애플리케이션
   - 다단계 빌드로 최적화
   - 멀티 플랫폼 지원 (linux/amd64, linux/arm64)

2. **Web Client** (`ghcr.io/dlddu/meal-appointment-v2/web-client`)
   - Vite로 빌드된 React SPA
   - Nginx Alpine에서 정적 파일 제공
   - 다단계 빌드로 최적화
   - 멀티 플랫폼 지원 (linux/amd64, linux/arm64)

## 워크플로우 트리거

워크플로우는 다음 이벤트에서 실행됩니다:

- `main` 또는 `develop` 브랜치에 푸시
- `main` 또는 `develop` 브랜치로 향하는 Pull Request
- `v*` 형식의 태그 푸시 (예: `v1.0.0`)
- 수동 실행 (workflow_dispatch)

## 이미지 태그

이미지는 다음 규칙에 따라 태그가 지정됩니다:

- **브랜치 이름**: `ghcr.io/dlddu/meal-appointment-v2/api-server:main`
- **PR 번호**: `ghcr.io/dlddu/meal-appointment-v2/api-server:pr-123`
- **Semantic Version 태그**: 
  - `ghcr.io/dlddu/meal-appointment-v2/api-server:1.0.0`
  - `ghcr.io/dlddu/meal-appointment-v2/api-server:1.0`
  - `ghcr.io/dlddu/meal-appointment-v2/api-server:1`
- **커밋 SHA**: `ghcr.io/dlddu/meal-appointment-v2/api-server:sha-abc1234`

## 로컬에서 이미지 빌드

로컬에서 멀티 플랫폼 이미지를 빌드하려면 Docker Buildx를 사용해야 합니다.

### API Server

```bash
# 단일 플랫폼 빌드 (현재 아키텍처)
docker build -f api-server/Dockerfile -t meal-appointment-api:local .

# 멀티 플랫폼 빌드 (amd64 및 arm64)
docker buildx build --platform linux/amd64,linux/arm64 \
  -f api-server/Dockerfile -t meal-appointment-api:local .
```

### Web Client

```bash
# 단일 플랫폼 빌드 (현재 아키텍처)
docker build -f web-client/Dockerfile -t meal-appointment-web:local .

# 멀티 플랫폼 빌드 (amd64 및 arm64)
docker buildx build --platform linux/amd64,linux/arm64 \
  -f web-client/Dockerfile -t meal-appointment-web:local .
```

## 이미지 실행

### API Server

```bash
docker run -p 4000:4000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/dbname \
  -e NODE_ENV=production \
  ghcr.io/dlddu/meal-appointment-v2/api-server:main
```

**참고**: API 서버 컨테이너는 시작 시 자동으로 다음 작업을 수행합니다:
1. PostgreSQL 연결 대기 (최대 30초)
2. Prisma 마이그레이션 실행 (`prisma migrate deploy`)
3. 데이터베이스 시딩 (초기 템플릿 데이터 생성)
4. API 서버 시작

데이터베이스가 아직 준비되지 않았거나 마이그레이션이 필요한 경우, 컨테이너가 자동으로 처리합니다.

### Web Client

```bash
docker run -p 8080:80 \
  ghcr.io/dlddu/meal-appointment-v2/web-client:main
```

웹 클라이언트는 `http://localhost:8080`에서 접근할 수 있습니다.

## 환경 변수

### API Server

- `DATABASE_URL`: PostgreSQL 연결 문자열 (필수)
- `PORT`: 서버 포트 (기본값: 4000)
- `NODE_ENV`: 실행 환경 (production/development)
- `LOG_LEVEL`: 로그 레벨 (info/debug/error)
- `OPENSSL_LIB_DIR`: OpenSSL 라이브러리 경로 (기본값: /usr/lib, Prisma 호환성을 위해 설정됨)
- `OPENSSL_INCLUDE_DIR`: OpenSSL 헤더 경로 (기본값: /usr/include, Prisma 호환성을 위해 설정됨)

### Web Client

웹 클라이언트는 빌드 타임에 환경 변수가 설정되어야 합니다. 런타임에서는 변경할 수 없습니다.

## 파일 구조

```
.github/workflows/
  build-images.yml          # GitHub Actions 워크플로우

api-server/
  Dockerfile               # API 서버 Dockerfile
  docker-entrypoint.sh     # 컨테이너 시작 스크립트 (마이그레이션 및 시딩 포함)
  .dockerignore           # Docker 빌드 제외 파일
  prisma/
    schema.prisma          # Prisma 스키마
    seed.ts               # 개발용 시드 스크립트 (TypeScript)
    seed.prod.js          # 프로덕션용 시드 스크립트 (JavaScript)
    migrations/           # 데이터베이스 마이그레이션

web-client/
  Dockerfile               # 웹 클라이언트 Dockerfile
  .dockerignore           # Docker 빌드 제외 파일
  nginx.conf              # Nginx 설정 파일
```

## 최적화 기능

- **다단계 빌드**: 빌드 스테이지와 프로덕션 스테이지 분리로 이미지 크기 최소화
- **레이어 캐싱**: GitHub Actions 캐시를 활용하여 빌드 시간 단축
- **Alpine Linux**: 경량 베이스 이미지 사용
- **Workspace 지원**: npm workspace 모노레포 구조를 지원하는 빌드 구성
- **멀티 플랫폼**: AMD64 및 ARM64 아키텍처 지원으로 다양한 환경에서 실행 가능
- **자동 DB 초기화**: 컨테이너 시작 시 자동으로 데이터베이스 마이그레이션 및 시딩 수행
- **OpenSSL 호환성**: Alpine Linux의 OpenSSL 3.x와 Prisma 간의 호환성 설정

## 주의사항

- Pull Request에서는 이미지가 빌드되지만 레지스트리에 푸시되지 않습니다 (보안상의 이유)
- `main`과 `develop` 브랜치의 푸시만 실제로 이미지를 레지스트리에 푸시합니다
- 이미지를 pull하려면 GitHub 인증이 필요할 수 있습니다

## 문제 해결

### Prisma OpenSSL 경고

컨테이너 로그에서 다음과 같은 경고가 나타날 수 있습니다:
```
prisma:warn Prisma failed to detect the libssl/openssl version to use
```

이는 무시해도 되는 경고입니다. Dockerfile에서 `OPENSSL_LIB_DIR` 및 `OPENSSL_INCLUDE_DIR` 환경 변수를 설정하여 Prisma가 Alpine Linux의 OpenSSL 3.x를 올바르게 사용하도록 구성되어 있습니다.

### 데이터베이스 연결 실패

컨테이너가 시작 시 PostgreSQL에 연결할 수 없는 경우, 최대 30초 동안 재시도합니다. 다음을 확인하세요:
- `DATABASE_URL` 환경 변수가 올바르게 설정되었는지
- PostgreSQL 서버가 실행 중인지
- 네트워크 연결이 가능한지
- 방화벽 규칙이 올바른지

### 마이그레이션 실패

마이그레이션이 실패하는 경우:
1. 데이터베이스 사용자가 스키마 변경 권한을 가지고 있는지 확인
2. 데이터베이스가 비어있거나 이전 마이그레이션 상태와 호환되는지 확인
3. 필요한 경우 수동으로 `prisma migrate reset`을 실행하여 데이터베이스를 초기화

## 이미지 Pull

GitHub Container Registry에서 이미지를 pull하려면:

```bash
# GitHub Personal Access Token으로 로그인
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# 이미지 pull
docker pull ghcr.io/dlddu/meal-appointment-v2/api-server:main
docker pull ghcr.io/dlddu/meal-appointment-v2/web-client:main
```
