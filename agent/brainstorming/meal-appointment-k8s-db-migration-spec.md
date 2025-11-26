# Kubernetes DB 마이그레이션 전략 명세

## 개요
meal-appointment-v2 애플리케이션을 Kubernetes 환경에 배포할 때 PostgreSQL 데이터베이스 마이그레이션을 안전하고 효율적으로 처리하기 위한 전략을 수립한다.

## 현황 분석

### 현재 마이그레이션 구조
- **마이그레이션 도구**: Prisma 기반 SQL 마이그레이션
- **마이그레이션 파일 위치**: `api-server/prisma/migrations/`
- **적용 스크립트**: `api-server/scripts/apply-migrations.ts`
- **기존 마이그레이션**:
  - `20240215000000_init`: 초기 스키마 생성
  - `20240301000000_update_appointments_table`: Appointment 테이블 업데이트
  - `20240401000000_view_appointment_support`: 조회 기능 지원
  - `20240515000000_participation_support`: 참여자 기능 지원

### 현재 마이그레이션 방식의 특징
- **DROP CASCADE 방식**: `apply-migrations.ts`가 모든 테이블을 삭제 후 재생성
- **멱등성 부족**: 기존 데이터를 보존하지 않음
- **로컬 개발 환경 중심**: 프로덕션 환경을 고려하지 않은 구조

### Docker 이미지 구조
- **빌드 단계**: Node.js 20 Alpine 기반
- **마이그레이션 파일 포함**: Prisma 스키마와 마이그레이션 파일이 이미지에 포함됨
- **실행 환경**: 프로덕션 모드로 실행

## Kubernetes 환경 고려사항

### 1. 배포 아키텍처
- **StatefulSet vs Deployment**: API 서버는 Deployment로 배포 가능 (스테이트리스)
- **데이터베이스**: 외부 관리형 PostgreSQL 또는 StatefulSet으로 운영
- **서비스 메쉬**: 필요시 Istio/Linkerd 등 고려

### 2. 마이그레이션 실행 시점
- **애플리케이션 시작 전**: InitContainer 또는 별도 Job으로 실행
- **무중단 배포 고려**: Rolling Update 시 마이그레이션 충돌 방지
- **멱등성 보장**: 여러 Pod가 동시 시작해도 안전해야 함

### 3. 데이터 안전성
- **백업 전략**: 마이그레이션 전 자동 백업
- **롤백 계획**: 실패 시 이전 버전으로 복구 방안
- **테스트 환경**: 프로덕션 적용 전 스테이징 환경에서 검증

## 제안하는 마이그레이션 전략

### 전략 1: Kubernetes Job 기반 마이그레이션 (권장)

#### 구조
```
마이그레이션 Job (완료 시까지 대기)
    ↓
애플리케이션 Deployment 배포
```

#### 장점
- 마이그레이션과 애플리케이션 배포 분리
- 실패 시 애플리케이션 배포 차단
- 로그 추적 용이
- 여러 번 실행해도 안전 (멱등성 보장)

#### 구현 방안
1. **Pre-migration Job**: 
   - 데이터베이스 백업 수행
   - 현재 스키마 버전 확인
   
2. **Migration Job**:
   - Prisma Migrate Deploy 명령 실행
   - 실패 시 롤백 트리거
   - 성공 시 버전 태그 기록

3. **Post-migration Validation**:
   - 스키마 정합성 검증
   - 기본 데이터 시드 (필요시)

#### Manifest 구조
- `migration-job.yaml`: 마이그레이션 실행 Job
- `api-deployment.yaml`: API 서버 Deployment
- `postgres-statefulset.yaml`: PostgreSQL StatefulSet (자체 운영 시)
- `postgres-pvc.yaml`: 영구 볼륨 클레임
- `configmap.yaml`: 환경 설정
- `secret.yaml`: 데이터베이스 자격증명

### 전략 2: InitContainer 기반 마이그레이션

#### 구조
```
Pod 시작
    ↓
InitContainer: 마이그레이션 실행
    ↓
Main Container: API 서버 실행
```

#### 장점
- 단일 Deployment로 관리
- 자동화된 마이그레이션
- 롤링 업데이트 시 순차 적용

#### 단점
- 여러 Pod가 동시 시작 시 경합 가능
- 마이그레이션 실패 시 Pod 재시작 반복

#### 구현 방안
1. **Lock 메커니즘**: PostgreSQL Advisory Lock 사용
2. **멱등성 보장**: Prisma Migrate의 `prisma migrate deploy` 사용
3. **타임아웃 설정**: InitContainer 타임아웃 적절히 설정

### 전략 3: Flux CD GitOps 기반 마이그레이션

#### 구조 (dlddu/flux-cd 레포지토리와 연동 가정)
```
Git Push (새 마이그레이션)
    ↓
Flux CD Sync
    ↓
Kustomization: Migration Job 적용
    ↓
HelmRelease: API 서버 업데이트
```

#### 장점
- 선언적 배포 관리
- Git을 통한 변경 이력 추적
- 자동 롤백 기능
- 환경별 설정 분리 (dev/staging/prod)

#### 구현 방안
1. **Kustomization 구조**:
   ```
   base/
     ├── migration-job.yaml
     ├── api-deployment.yaml
     └── kustomization.yaml
   overlays/
     ├── dev/
     ├── staging/
     └── production/
   ```

2. **Flux CD 설정**:
   - `GitRepository`: meal-appointment-v2 레포지토리 참조
   - `Kustomization`: 환경별 오버레이 적용
   - `HelmRelease`: 버전 관리

3. **마이그레이션 순서 제어**:
   - Flux CD의 `dependsOn` 필드 활용
   - Migration Job 완료 후 Deployment 업데이트

## 마이그레이션 스크립트 개선 필요사항

### 현재 문제점
- `apply-migrations.ts`가 `DROP TABLE` 수행 → 프로덕션 사용 불가
- 환경별 설정 파일 하드코딩
- 롤백 기능 없음

### 개선 방안
1. **Prisma Migrate Deploy 사용**:
   ```bash
   npx prisma migrate deploy
   ```
   - 이미 적용된 마이그레이션 건너뛰기
   - 멱등성 보장
   - `_prisma_migrations` 테이블로 버전 관리

2. **환경변수 기반 설정**:
   - Kubernetes Secret/ConfigMap에서 DATABASE_URL 주입
   - 환경별 설정 파일 제거

3. **헬스체크 추가**:
   - 마이그레이션 완료 후 `/health` 엔드포인트로 검증
   - Kubernetes Readiness Probe에서 활용

4. **백업 자동화**:
   ```bash
   pg_dump -Fc $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).dump
   ```

## 배포 시나리오

### 시나리오 1: 최초 배포
1. PostgreSQL 배포 (StatefulSet 또는 외부 서비스)
2. Secret/ConfigMap 생성
3. Migration Job 실행 → 초기 스키마 생성
4. API Deployment 배포
5. Service/Ingress 설정

### 시나리오 2: 새 마이그레이션 배포
1. 새 마이그레이션 파일 추가 → Git Push
2. 새 Docker 이미지 빌드 (GitHub Actions)
3. Flux CD가 변경 감지
4. Migration Job 재실행 (새 마이그레이션만 적용)
5. API Deployment Rolling Update

### 시나리오 3: 롤백
1. 문제 감지
2. Git Revert
3. Flux CD가 이전 버전으로 롤백
4. 데이터베이스는 백업에서 복원 (필요시)

## 모니터링 및 알림

### 1. 로그 수집
- Fluent Bit/Fluentd로 마이그레이션 로그 수집
- Elasticsearch/Loki에 저장
- Kibana/Grafana로 시각화

### 2. 메트릭
- 마이그레이션 소요 시간
- 성공/실패 횟수
- 데이터베이스 크기 변화

### 3. 알림
- Slack/Discord 웹훅
- 마이그레이션 실패 시 즉시 알림
- 장시간 실행 시 경고

## 보안 고려사항

### 1. Secret 관리
- Kubernetes Secret (base64 인코딩)
- External Secrets Operator (AWS Secrets Manager, HashiCorp Vault)
- Sealed Secrets

### 2. RBAC
- 마이그레이션 Job 전용 ServiceAccount
- 최소 권한 원칙

### 3. 네트워크 정책
- 마이그레이션 Job → PostgreSQL만 허용
- API 서버 → PostgreSQL 허용

## 테스트 전략

### 1. 로컬 테스트
- Minikube/Kind로 로컬 Kubernetes 클러스터 구성
- 마이그레이션 Job 테스트
- 롤백 시나리오 검증

### 2. 스테이징 환경
- 프로덕션과 동일한 구성
- 실제 데이터 샘플로 테스트
- 성능 측정

### 3. Canary 배포
- 일부 Pod만 새 버전으로 업데이트
- 문제 발생 시 즉시 롤백

## 권장 구현 순서

1. **1단계**: Prisma Migrate Deploy로 마이그레이션 스크립트 개선
2. **2단계**: Migration Job Manifest 작성 및 테스트
3. **3단계**: Flux CD 연동 (dlddu/flux-cd 레포지토리)
4. **4단계**: 스테이징 환경 배포 및 검증
5. **5단계**: 프로덕션 배포 및 모니터링 설정

## 결론

Kubernetes 환경에서 안전한 DB 마이그레이션을 위해서는:
- **분리된 마이그레이션 실행**: Job 또는 InitContainer
- **멱등성 보장**: Prisma Migrate Deploy 사용
- **GitOps 적용**: Flux CD로 선언적 관리
- **철저한 테스트**: 로컬 → 스테이징 → 프로덕션
- **모니터링 및 롤백 계획**: 문제 발생 시 신속한 대응

가장 권장하는 방식은 **Kubernetes Job + Flux CD GitOps** 조합이며, 이는 안전성, 추적성, 자동화 측면에서 가장 우수하다.
