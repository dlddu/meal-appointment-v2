# 식사 약속 생성 백엔드 명세 평탄화
1. `POST /appointments` 엔드포인트는 로그인 없이 제목, 설명, 시간 슬롯 템플릿을 검증하고 저장해 공유 URL을 반환해야 한다.
2. 요청 본문은 `title`, `summary`, `timeSlotTemplateId` 세 필드를 포함하며 JSON과 `Content-Type: application/json`을 사용해야 한다.
3. `title`은 앞뒤 공백 제거 후 1~60자 범위를 만족하지 않으면 거부해야 한다.
4. `summary`는 0~200자 범위를 검증하고 null/undefined 입력 시 빈 문자열로 대체해 저장해야 한다.
5. `timeSlotTemplateId`는 현재 `default_weekly`만 유효하며 활성 템플릿 목록 기반 검증 구조를 유지해야 한다.
6. 성공 응답은 201 상태와 함께 `appointmentId`(UUID v4), `shareUrl`, `title`, `summary`, `timeSlotTemplateId`, `createdAt`을 JSON으로 반환해야 한다.
7. `shareUrl`은 `/appointments/{appointmentId}` 상대 경로만 반환해야 하며 클라이언트가 절대 URL을 조합한다.
8. Express 미들웨어에서 스키마 기반 검증을 수행하고 서비스 계층에는 정제된 데이터만 전달해야 한다.
9. 서비스 계층은 단일 트랜잭션으로 약속 레코드를 생성하고 `AppointmentRepository.create`와 `ShareUrlBuilder`를 사용해야 한다.
10. 응답 DTO는 저장된 레코드를 camelCase로 직렬화하고 생성 이벤트를 `appointment.created` 로그로 남겨야 한다.
11. `appointments` 테이블은 `id`, `title`, `summary`, `time_slot_template_id`, `created_at` 컬럼을 포함해야 한다.
12. Prisma 모델은 `summary`를 기본값 `""`가 설정된 필수 문자열로 정의하고 서비스 계층에서 `summary ?? ''` 처리를 적용해야 한다.
13. 활성 템플릿 목록은 초기에는 하드코딩 후 5분 TTL 메모리 캐시로 관리하며 향후 DB 기반 검증으로 확장할 수 있어야 한다.
14. 검증 실패 시 400 오류를 `{ "error": "VALIDATION_ERROR", "details": [...] }` 구조로 반환해야 한다.
15. 데이터베이스 장애 등 일시적 문제는 503 오류 `{ "error": "SERVICE_UNAVAILABLE" }`로 응답해야 한다.
16. 예기치 못한 예외는 500 오류로 일반 메시지를 반환하고 내부적으로 로깅해야 한다.
17. 레이트 리밋은 IP 기준 분당 30회로 설정하고 CORS는 백엔드에서 처리하지 않으며 필요 시 리버스 프록시 설정 지침을 문서화해야 한다.
18. 입력 문자열은 저장 시 이스케이프하지 않지만 로깅할 때 200자로 잘라 안전하게 기록해야 한다.
19. Pino 로거와 요청 ID 미들웨어로 추적성을 확보해야 한다.
20. Prometheus 카운터 `appointments_created_total`을 증가시키고 관련 검증은 e2e 또는 통합 단계에서 확인해야 한다.
21. 단위 테스트는 서비스 계층의 성공/실패 시나리오를, 통합 테스트는 DB 삽입과 응답 구조를, 회귀 테스트는 템플릿 비활성화 시 400 응답을 확인해야 한다.
