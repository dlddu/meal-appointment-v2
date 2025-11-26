# Kubernetes DB 마이그레이션 전략 체크리스트

## 현황 분석
- [ ] 1. 현재 Prisma 기반 SQL 마이그레이션 사용 확인
- [ ] 2. 마이그레이션 파일 위치 확인: `api-server/prisma/migrations/`
- [ ] 3. 적용 스크립트 확인: `api-server/scripts/apply-migrations.ts`
- [ ] 4. 기존 4개 마이그레이션 파일 확인 (init, update_appointments, view_appointment, participation)
- [ ] 5. 현재 방식이 DROP CASCADE로 데이터 삭제하는 문제점 파악
- [ ] 6. 멱등성 부족 문제 확인
- [ ] 7. 로컬 개발 환경 중심 설계 확인
- [ ] 8. Docker 이미지 구조 확인 (Node.js 20 Alpine)
- [ ] 9. Prisma 스키마와 마이그레이션 파일이 이미지에 포함된 것 확인

## Kubernetes 환경 고려사항
- [ ] 10. API 서버를 Deployment로 배포하는 아키텍처 설계
- [ ] 11. PostgreSQL 운영 방식 결정 (외부 관리형 vs StatefulSet)
- [ ] 12. 서비스 메쉬 필요 여부 검토 (Istio/Linkerd)
- [ ] 13. 마이그레이션 실행 시점 결정 (InitContainer vs Job)
- [ ] 14. Rolling Update 시 마이그레이션 충돌 방지 방안 수립
- [ ] 15. 여러 Pod 동시 시작 시 멱등성 보장 방안 마련
- [ ] 16. 마이그레이션 전 자동 백업 전략 수립
- [ ] 17. 실패 시 롤백 계획 수립
- [ ] 18. 스테이징 환경 검증 프로세스 정의

## 전략 1: Kubernetes Job 기반 마이그레이션 (권장)
- [ ] 19. Migration Job → Deployment 순서로 배포하는 구조 설계
- [ ] 20. Pre-migration Job에서 DB 백업 수행 구현
- [ ] 21. Pre-migration Job에서 현재 스키마 버전 확인 구현
- [ ] 22. Migration Job에서 Prisma Migrate Deploy 실행
- [ ] 23. 마이그레이션 실패 시 롤백 트리거 구현
- [ ] 24. 마이그레이션 성공 시 버전 태그 기록 구현
- [ ] 25. Post-migration에서 스키마 정합성 검증 구현
- [ ] 26. 필요시 기본 데이터 시드 기능 추가
- [ ] 27. `migration-job.yaml` Manifest 작성
- [ ] 28. `api-deployment.yaml` Manifest 작성
- [ ] 29. `postgres-statefulset.yaml` Manifest 작성 (자체 운영 시)
- [ ] 30. `postgres-pvc.yaml` Manifest 작성
- [ ] 31. `configmap.yaml` Manifest 작성
- [ ] 32. `secret.yaml` Manifest 작성

## 전략 2: InitContainer 기반 마이그레이션
- [ ] 33. InitContainer에서 마이그레이션 실행하는 Pod 정의 작성
- [ ] 34. PostgreSQL Advisory Lock 메커니즘 구현
- [ ] 35. Prisma Migrate Deploy로 멱등성 보장 확인
- [ ] 36. InitContainer 타임아웃 적절히 설정
- [ ] 37. 여러 Pod 동시 시작 시 경합 처리 테스트
- [ ] 38. 마이그레이션 실패 시 Pod 재시작 정책 설정

## 전략 3: Flux CD GitOps 기반 마이그레이션
- [ ] 39. Kustomization base 디렉터리 구조 설계
- [ ] 40. `migration-job.yaml` 작성 (base)
- [ ] 41. `api-deployment.yaml` 작성 (base)
- [ ] 42. `kustomization.yaml` 작성 (base)
- [ ] 43. overlays/dev 환경별 설정 작성
- [ ] 44. overlays/staging 환경별 설정 작성
- [ ] 45. overlays/production 환경별 설정 작성
- [ ] 46. GitRepository 리소스 정의 (meal-appointment-v2 참조)
- [ ] 47. Kustomization 리소스 정의 (환경별 오버레이 적용)
- [ ] 48. HelmRelease 리소스 정의 (버전 관리)
- [ ] 49. Flux CD `dependsOn` 필드로 순서 제어 구현
- [ ] 50. dlddu/flux-cd 레포지토리에 Flux CD 설정 커밋

## 마이그레이션 스크립트 개선
- [ ] 51. `apply-migrations.ts`의 DROP TABLE 로직 제거
- [ ] 52. Prisma Migrate Deploy 명령으로 교체 (`npx prisma migrate deploy`)
- [ ] 53. 환경별 설정 파일 하드코딩 제거
- [ ] 54. Kubernetes Secret/ConfigMap에서 DATABASE_URL 주입하도록 변경
- [ ] 55. `_prisma_migrations` 테이블 기반 버전 관리 확인
- [ ] 56. `/health` 엔드포인트 헬스체크 추가
- [ ] 57. Kubernetes Readiness Probe 설정
- [ ] 58. `pg_dump` 명령으로 백업 자동화 스크립트 작성
- [ ] 59. 백업 파일명에 타임스탬프 포함 구현

## 배포 시나리오 - 최초 배포
- [ ] 60. PostgreSQL 배포 (StatefulSet 또는 외부 서비스)
- [ ] 61. Secret/ConfigMap 생성
- [ ] 62. Migration Job 실행하여 초기 스키마 생성
- [ ] 63. API Deployment 배포
- [ ] 64. Service 설정
- [ ] 65. Ingress 설정

## 배포 시나리오 - 새 마이그레이션 배포
- [ ] 66. 새 마이그레이션 파일 추가
- [ ] 67. Git Push
- [ ] 68. GitHub Actions로 새 Docker 이미지 빌드 확인
- [ ] 69. Flux CD 변경 감지 확인
- [ ] 70. Migration Job 재실행 확인 (새 마이그레이션만 적용)
- [ ] 71. API Deployment Rolling Update 확인

## 배포 시나리오 - 롤백
- [ ] 72. 문제 감지 메커니즘 구현
- [ ] 73. Git Revert 수행
- [ ] 74. Flux CD 이전 버전 롤백 확인
- [ ] 75. 필요시 DB 백업에서 복원 절차 수립

## 모니터링 및 알림
- [ ] 76. Fluent Bit/Fluentd 로그 수집 설정
- [ ] 77. Elasticsearch/Loki 저장소 설정
- [ ] 78. Kibana/Grafana 시각화 대시보드 구성
- [ ] 79. 마이그레이션 소요 시간 메트릭 수집
- [ ] 80. 성공/실패 횟수 메트릭 수집
- [ ] 81. 데이터베이스 크기 변화 메트릭 수집
- [ ] 82. Slack/Discord 웹훅 설정
- [ ] 83. 마이그레이션 실패 시 즉시 알림 구현
- [ ] 84. 장시간 실행 시 경고 알림 구현

## 보안 고려사항
- [ ] 85. Kubernetes Secret 생성 (base64 인코딩)
- [ ] 86. External Secrets Operator 검토 (AWS Secrets Manager/Vault)
- [ ] 87. Sealed Secrets 검토
- [ ] 88. 마이그레이션 Job 전용 ServiceAccount 생성
- [ ] 89. 최소 권한 원칙 RBAC 설정
- [ ] 90. NetworkPolicy: Migration Job → PostgreSQL 허용
- [ ] 91. NetworkPolicy: API Server → PostgreSQL 허용

## 테스트 전략
- [ ] 92. Minikube/Kind 로컬 Kubernetes 클러스터 구성
- [ ] 93. 로컬 환경에서 Migration Job 테스트
- [ ] 94. 롤백 시나리오 검증
- [ ] 95. 스테이징 환경 구성 (프로덕션과 동일)
- [ ] 96. 실제 데이터 샘플로 테스트
- [ ] 97. 성능 측정
- [ ] 98. Canary 배포 전략 수립
- [ ] 99. 일부 Pod만 새 버전 업데이트 테스트
- [ ] 100. 문제 발생 시 즉시 롤백 테스트

## 권장 구현 순서
- [ ] 101. 1단계: Prisma Migrate Deploy로 마이그레이션 스크립트 개선
- [ ] 102. 2단계: Migration Job Manifest 작성
- [ ] 103. 2단계: Migration Job 테스트
- [ ] 104. 3단계: Flux CD 연동 (dlddu/flux-cd 레포지토리)
- [ ] 105. 4단계: 스테이징 환경 배포
- [ ] 106. 4단계: 스테이징 환경 검증
- [ ] 107. 5단계: 프로덕션 배포
- [ ] 108. 5단계: 모니터링 설정

## 최종 확인
- [ ] 109. 분리된 마이그레이션 실행 (Job 또는 InitContainer) 확인
- [ ] 110. Prisma Migrate Deploy로 멱등성 보장 확인
- [ ] 111. Flux CD GitOps 선언적 관리 확인
- [ ] 112. 로컬→스테이징→프로덕션 테스트 순서 준수 확인
- [ ] 113. 모니터링 및 롤백 계획 수립 확인
- [ ] 114. Kubernetes Job + Flux CD GitOps 조합 구현 확인
