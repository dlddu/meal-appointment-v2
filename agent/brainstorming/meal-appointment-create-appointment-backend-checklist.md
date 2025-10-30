# 식사 약속 생성 백엔드 체크리스트
1. (상태: 미검토) `POST /appointments`가 로그인 없이 제목·설명·템플릿을 검증하고 저장 후 공유 URL을 반환하는지 확인한다.
2. (상태: 미검토) 요청 본문이 `title`, `summary`, `timeSlotTemplateId` 세 필드를 포함하고 JSON으로 전달되는지 확인한다.
3. (상태: 미검토) `title`을 트리밍한 뒤 1~60자 범위를 벗어나면 거부하는지 확인한다.
4. (상태: 미검토) `summary`를 0~200자 범위로 검증하고 누락 시 빈 문자열로 저장하는지 확인한다.
5. (상태: 미검토) `timeSlotTemplateId`가 `default_weekly` 등 활성 템플릿 목록을 기반으로 검증되는지 확인한다.
6. (상태: 미검토) 성공 응답이 201 상태와 `appointmentId`, `shareUrl`, `title`, `summary`, `timeSlotTemplateId`, `createdAt`을 포함하는지 확인한다.
7. (상태: 반려 - shareUrl은 항상 상대 경로이며 PUBLIC_BASE_URL을 사용하지 않는다) `shareUrl`이 기본적으로 상대 경로이며 `PUBLIC_BASE_URL`이 설정되면 절대 URL을 반환할 수 있는지 확인한다.
8. (상태: 미검토) Express 미들웨어에서 스키마 기반 입력 검증 후 서비스 계층으로 정제된 데이터만 전달하는지 확인한다.
9. (상태: 미검토) 서비스 계층이 단일 트랜잭션으로 레코드를 생성하고 `AppointmentRepository.create`와 `ShareUrlBuilder`를 호출하는지 확인한다.
10. (상태: 미검토) 응답 DTO가 camelCase로 직렬화되고 `appointment.created` 로그 이벤트가 남는지 확인한다.
11. (상태: 미검토) `appointments` 테이블이 필요한 컬럼(`id`, `title`, `summary`, `time_slot_template_id`, `created_at`)을 포함하는지 확인한다.
12. (상태: 반려 - summary 필드는 NOT NULL이며 기본값으로 빈 문자열을 사용한다) Prisma 모델이 `summary` 선택 필드를 `summary ?? ''` 처리와 함께 구현하는지 확인한다.
13. (상태: 미검토) 활성 템플릿 목록을 캐시(5분 TTL)로 관리하면서 향후 DB 기반 검증으로 확장 가능한 구조인지 확인한다.
14. (상태: 미검토) 검증 실패 시 400 오류와 `VALIDATION_ERROR` 상세 구조를 반환하는지 확인한다.
15. (상태: 미검토) 일시적 장애에 503 오류와 `SERVICE_UNAVAILABLE` 코드를 반환하는지 확인한다.
16. (상태: 미검토) 예기치 못한 예외에 500 오류를 반환하고 내부 로깅을 수행하는지 확인한다.
17. (상태: 반려 - CORS는 백엔드에서 처리하지 않고 인프라 레이어에서 다룬다) IP 기준 분당 30회 레이트 리밋과 제한된 CORS 도메인이 적용되는지 확인한다.
18. (상태: 미검토) 입력 문자열을 저장 시 이스케이프하지 않되 로그 기록 시 200자로 잘라 안전하게 처리하는지 확인한다.
19. (상태: 미검토) Pino 로거와 요청 ID 미들웨어로 추적성을 확보하는지 확인한다.
20. (상태: 미검토) `appointments_created_total` Prometheus 카운터가 증가하고 관련 검증이 준비되어 있는지 확인한다.
21. (상태: 미검토) 단위·통합·회귀 테스트가 명세된 시나리오를 검증하는지 확인한다.
22. (상태: 미검토) `shareUrl`이 `/appointments/{appointmentId}` 상대 경로만 반환되는지 확인한다.
23. (상태: 미검토) `appointments.summary` 컬럼이 `NOT NULL DEFAULT ''`로 정의되고 Prisma 모델도 필수 문자열로 구성되는지 확인한다.
24. (상태: 미검토) CORS 요구가 있을 경우 백엔드 대신 리버스 프록시 등 인프라 레이어에서 처리하도록 운영 문서에 남기는지 확인한다.
