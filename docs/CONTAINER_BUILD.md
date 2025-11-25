# Container Image Build

이 저장소에는 API 서버와 웹 클라이언트를 위한 컨테이너 이미지 빌드 워크플로우가 포함되어 있습니다.

## 개요

GitHub Actions를 사용하여 다음 두 개의 컨테이너 이미지를 자동으로 빌드하고 GitHub Container Registry(ghcr.io)에 푸시합니다:

1. **API Server** (`ghcr.io/dlddu/meal-appointment-v2/api-server`)
   - Node.js 20 Alpine 기반
   - Express 백엔드 애플리케이션
   - 다단계 빌드로 최적화

2. **Web Client** (`ghcr.io/dlddu/meal-appointment-v2/web-client`)
   - Vite로 빌드된 React SPA
   - Nginx Alpine에서 정적 파일 제공
   - 다단계 빌드로 최적화

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
- **커밋 SHA**: `ghcr.io/dlddu/meal-appointment-v2/api-server:main-abc1234`

## 로컬에서 이미지 빌드

### API Server

```bash
docker build -f api-server/Dockerfile -t meal-appointment-api:local .
```

### Web Client

```bash
docker build -f web-client/Dockerfile -t meal-appointment-web:local .
```

## 이미지 실행

### API Server

```bash
docker run -p 4000:4000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/dbname \
  -e NODE_ENV=production \
  ghcr.io/dlddu/meal-appointment-v2/api-server:main
```

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

### Web Client

웹 클라이언트는 빌드 타임에 환경 변수가 설정되어야 합니다. 런타임에서는 변경할 수 없습니다.

## 파일 구조

```
.github/workflows/
  build-images.yml          # GitHub Actions 워크플로우

api-server/
  Dockerfile               # API 서버 Dockerfile
  .dockerignore           # Docker 빌드 제외 파일

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

## 주의사항

- Pull Request에서는 이미지가 빌드되지만 레지스트리에 푸시되지 않습니다 (보안상의 이유)
- `main`과 `develop` 브랜치의 푸시만 실제로 이미지를 레지스트리에 푸시합니다
- 이미지를 pull하려면 GitHub 인증이 필요할 수 있습니다

## 이미지 Pull

GitHub Container Registry에서 이미지를 pull하려면:

```bash
# GitHub Personal Access Token으로 로그인
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# 이미지 pull
docker pull ghcr.io/dlddu/meal-appointment-v2/api-server:main
docker pull ghcr.io/dlddu/meal-appointment-v2/web-client:main
```
