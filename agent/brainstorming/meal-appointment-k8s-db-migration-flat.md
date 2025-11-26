# Kubernetes DB 마이그레이션 전략 (평탄화 버전)

## 현황 분석
현재 애플리케이션은 Prisma 기반 SQL 마이그레이션을 사용하며, `api-server/prisma/migrations/` 디렉터리에 마이그레이션 파일을 저장한다. `api-server/scripts/apply-migrations.ts` 스크립트로 마이그레이션을 적용한다. 기존 마이그레이션은 4개이며, 초기 스키마 생성, Appointment 테이블 업데이트, 조회 기능 지원, 참여자 기능 지원을 포함한다.

현재 마이그레이션 방식은 DROP CASCADE로 모든 테이블을 삭제 후 재생성하므로 멱등성이 부족하고 기존 데이터를 보존하지 않는다. 이는 로컬 개발 환경 중심으로 설계되어 프로덕션 환경을 고려하지 않았다.

Docker 이미지는 Node.js 20 Alpine 기반이며, Prisma 스키마와 마이그레이션 파일이 이미지에 포함되어 프로덕션 모드로 실행된다.

## Kubernetes 환경 고려사항
API 서버는 스테이트리스하므로 Deployment로 배포 가능하다. 데이터베이스는 외부 관리형 PostgreSQL 또는 StatefulSet으로 운영한다. 필요시 Istio/Linkerd 등 서비스 메쉬를 고려할 수 있다.

마이그레이션은 애플리케이션 시작 전에 InitContainer 또는 별도 Job으로 실행해야 한다. 무중단 배포를 위해 Rolling Update 시 마이그레이션 충돌을 방지해야 하며, 여러 Pod가 동시 시작해도 안전하도록 멱등성을 보장해야 한다.

데이터 안전성을 위해 마이그레이션 전 자동 백업을 수행하고, 실패 시 이전 버전으로 복구할 롤백 계획을 수립해야 한다. 프로덕션 적용 전 스테이징 환경에서 검증해야 한다.

## 전략 1: Kubernetes Job 기반 마이그레이션 (권장)
마이그레이션 Job이 완료될 때까지 대기한 후 애플리케이션 Deployment를 배포한다. 이 방식은 마이그레이션과 애플리케이션 배포를 분리하고, 실패 시 애플리케이션 배포를 차단하며, 로그 추적이 용이하고, 여러 번 실행해도 안전하다.

Pre-migration Job은 데이터베이스 백업을 수행하고 현재 스키마 버전을 확인한다. Migration Job은 Prisma Migrate Deploy 명령을 실행하며, 실패 시 롤백을 트리거하고 성공 시 버전 태그를 기록한다. Post-migration Validation은 스키마 정합성을 검증하고 필요시 기본 데이터를 시드한다.

Manifest 구조는 마이그레이션 실행 Job, API 서버 Deployment, PostgreSQL StatefulSet, 영구 볼륨 클레임, 환경 설정 ConfigMap, 데이터베이스 자격증명 Secret을 포함한다.

## 전략 2: InitContainer 기반 마이그레이션
Pod 시작 후 InitContainer에서 마이그레이션을 실행하고, 완료되면 Main Container에서 API 서버를 실행한다. 이 방식은 단일 Deployment로 관리 가능하고, 자동화된 마이그레이션을 제공하며, 롤링 업데이트 시 순차 적용된다.

단점은 여러 Pod가 동시 시작 시 경합이 발생할 수 있고, 마이그레이션 실패 시 Pod 재시작이 반복된다는 것이다.

PostgreSQL Advisory Lock을 사용하여 Lock 메커니즘을 구현하고, Prisma Migrate의 `prisma migrate deploy`로 멱등성을 보장하며, InitContainer 타임아웃을 적절히 설정한다.

## 전략 3: Flux CD GitOps 기반 마이그레이션
Git Push로 새 마이그레이션을 추가하면, Flux CD가 변경을 동기화하고, Kustomization이 Migration Job을 적용한 후, HelmRelease가 API 서버를 업데이트한다. 이 방식은 선언적 배포 관리를 제공하고, Git을 통한 변경 이력 추적이 가능하며, 자동 롤백 기능과 환경별 설정 분리를 지원한다.

Kustomization 구조는 base 디렉터리에 공통 매니페스트를 두고, overlays 디렉터리에 dev/staging/production 환경별 설정을 분리한다.

Flux CD 설정은 GitRepository로 meal-appointment-v2 레포지토리를 참조하고, Kustomization으로 환경별 오버레이를 적용하며, HelmRelease로 버전을 관리한다. Flux CD의 `dependsOn` 필드를 활용하여 Migration Job 완료 후 Deployment를 업데이트한다.

## 마이그레이션 스크립트 개선
현재 `apply-migrations.ts`는 `DROP TABLE`을 수행하여 프로덕션에서 사용할 수 없고, 환경별 설정 파일이 하드코딩되어 있으며, 롤백 기능이 없다.

Prisma Migrate Deploy(`npx prisma migrate deploy`)를 사용하면 이미 적용된 마이그레이션을 건너뛰고, 멱등성을 보장하며, `_prisma_migrations` 테이블로 버전을 관리한다.

환경변수 기반 설정으로 Kubernetes Secret/ConfigMap에서 DATABASE_URL을 주입하고, 환경별 설정 파일을 제거한다.

마이그레이션 완료 후 `/health` 엔드포인트로 검증하고, Kubernetes Readiness Probe에서 활용하는 헬스체크를 추가한다.

`pg_dump -Fc $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).dump` 명령으로 백업을 자동화한다.

## 배포 시나리오

### 최초 배포
PostgreSQL을 배포하고(StatefulSet 또는 외부 서비스), Secret/ConfigMap을 생성한다. Migration Job을 실행하여 초기 스키마를 생성하고, API Deployment를 배포한 후, Service/Ingress를 설정한다.

### 새 마이그레이션 배포
새 마이그레이션 파일을 추가하여 Git에 Push한다. GitHub Actions가 새 Docker 이미지를 빌드하고, Flux CD가 변경을 감지한다. Migration Job이 재실행되어 새 마이그레이션만 적용하고, API Deployment가 Rolling Update된다.

### 롤백
문제를 감지하면 Git Revert를 수행한다. Flux CD가 이전 버전으로 롤백하고, 필요시 데이터베이스는 백업에서 복원한다.

## 모니터링 및 알림
Fluent Bit/Fluentd로 마이그레이션 로그를 수집하여 Elasticsearch/Loki에 저장하고, Kibana/Grafana로 시각화한다.

마이그레이션 소요 시간, 성공/실패 횟수, 데이터베이스 크기 변화를 메트릭으로 수집한다.

Slack/Discord 웹훅을 사용하여 마이그레이션 실패 시 즉시 알림을 발송하고, 장시간 실행 시 경고를 보낸다.

## 보안 고려사항
Kubernetes Secret(base64 인코딩), External Secrets Operator(AWS Secrets Manager, HashiCorp Vault), Sealed Secrets로 Secret을 관리한다.

마이그레이션 Job 전용 ServiceAccount를 생성하고 최소 권한 원칙을 적용한다.

네트워크 정책으로 마이그레이션 Job → PostgreSQL만 허용하고, API 서버 → PostgreSQL을 허용한다.

## 테스트 전략
Minikube/Kind로 로컬 Kubernetes 클러스터를 구성하여 마이그레이션 Job을 테스트하고 롤백 시나리오를 검증한다.

스테이징 환경에서 프로덕션과 동일한 구성으로 실제 데이터 샘플을 테스트하고 성능을 측정한다.

Canary 배포로 일부 Pod만 새 버전으로 업데이트하고, 문제 발생 시 즉시 롤백한다.

## 권장 구현 순서
1단계는 Prisma Migrate Deploy로 마이그레이션 스크립트를 개선한다. 2단계는 Migration Job Manifest를 작성하고 테스트한다. 3단계는 Flux CD를 연동한다(dlddu/flux-cd 레포지토리). 4단계는 스테이징 환경에 배포하고 검증한다. 5단계는 프로덕션에 배포하고 모니터링을 설정한다.

## 결론
Kubernetes 환경에서 안전한 DB 마이그레이션을 위해서는 분리된 마이그레이션 실행(Job 또는 InitContainer), Prisma Migrate Deploy를 사용한 멱등성 보장, Flux CD를 활용한 GitOps 적용, 로컬→스테이징→프로덕션 순서의 철저한 테스트, 문제 발생 시 신속한 대응을 위한 모니터링 및 롤백 계획이 필요하다.

가장 권장하는 방식은 Kubernetes Job과 Flux CD GitOps를 조합하는 것이며, 이는 안전성, 추적성, 자동화 측면에서 가장 우수하다.
