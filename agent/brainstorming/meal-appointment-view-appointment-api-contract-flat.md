# 식사 약속 조회 API 계약 평탄화
1. GET `/api/appointments/{appointmentId}`는 인증 없이 JSON으로 약속 정보를 반환한다.
2. 경로 변수 `appointmentId`는 약속을 식별하며, 선택적 쿼리 `timezone`은 슬롯 시간 표시 타임존을 지정한다.
3. 성공 시 응답 객체는 `appointment`, `template`, `slots`, `participants`, `aggregates`, `metadata` 필드를 포함한다.
4. `appointment` 객체는 `id`, `title`, `summary`, `createdAt`, `updatedAt`, `timeSlotTemplateId`를 ISO-8601 시각 형식과 함께 제공한다.
5. `template` 객체는 템플릿 `id`, `name`, `description`과 각 규칙 요약(`dayPattern`, `mealType`, `label`) 목록을 담는다.
6. `slots` 배열의 각 항목은 `slotKey`, `start`, `end`, `dateLabel`, `mealLabel`, `templateRuleRef(ruleId, dayPattern, mealType)`을 제공한다.
7. `slotKey`는 날짜와 식사 시간대를 결합한 안정적 식별자이며, `start`와 `end`는 `timezone`에 맞춰 포맷된 ISO-8601 문자열이다.
8. `participants` 배열은 응답 제출자별 `participantId`, `nickname`, `submittedAt`, `responses` 목록을 노출한다.
9. 각 `responses` 항목은 `slotKey`와 `isAvailable` 불리언을 포함하며, 미선택 슬롯은 `false`로 저장한다.
10. `aggregates.slotSummaries`는 슬롯별로 `slotKey`, `totalResponses`, `availableCount`, `availabilityRatio`를 제공한다.
11. `aggregates.participantCount`는 전체 응답 제출자 수를 나타낸다.
12. `metadata`는 `refreshedAt`, `timezone`, `readOnly(true)`, `shareUrl`(`/appointments/{appointmentId}`)을 포함한다.
13. `slots`와 `aggregates.slotSummaries`는 동일한 `slotKey` 집합을 공유해야 한다.
14. API는 이메일이나 전화번호 등 민감 정보를 반환하지 않는다.
15. `refreshedAt` 필드를 통해 클라이언트가 데이터 최신 상태 여부를 판단하고 수동 새로고침을 안내할 수 있다.
16. `404` 오류는 약속 미존재 시 `APPOINTMENT_NOT_FOUND` 코드를 포함한 메시지를 반환한다.
17. `503` 오류는 템플릿 로딩 실패 등 일시적 문제 시 `SERVICE_UNAVAILABLE` 코드를 반환한다.
18. `500` 오류는 예기치 못한 서버 오류 시 `INTERNAL_ERROR` 코드를 반환한다.
19. 모든 오류 응답은 `{ "error": { "code": string, "message": string } }` 구조를 따른다.
20. 응답에는 닉네임 미등록 사용자 정보가 포함되지 않고, `participants` 배열에는 실제 응답 제출자만 노출된다.
