# 식사 약속 조회 API 계약 평탄화
1. GET `/api/appointments/{appointmentId}`는 인증 없이 JSON으로 약속 정보를 반환한다.
2. 경로 변수 `appointmentId`만 사용하며 추가 쿼리 파라미터는 지원하지 않는다.
3. 성공 시 응답 객체는 `appointment`, `template`, `participants`, `aggregates` 필드를 포함한다.
4. `appointment` 객체는 `id`, `title`, `summary`, `createdAt`, `updatedAt`, `timeSlotTemplateId`를 ISO-8601 시각 형식과 함께 제공한다.
5. `template` 객체는 템플릿 `id`, `name`, `description`과 전체 규칙(`rules`) 목록을 담고, 각 규칙은 `dayPattern`과 `mealTypes`에 정의된 원본 속성을 요약 없이 그대로 노출하며 별도 `ruleId`를 제공하지 않는다.
6. `participants` 배열은 응답 제출자별 `participantId`, `nickname`, `submittedAt`, `responses` 목록을 노출한다.
7. 각 `responses` 항목은 선택된 슬롯의 `slotKey`만 포함하며, 미선택 슬롯은 목록에 나타나지 않는다.
8. `slotKey`는 날짜(`YYYY-MM-DD`)와 규칙의 `mealType`을 `#`으로 결합한 안정적 식별자다.
9. `aggregates.slotSummaries`는 슬롯별로 `slotKey`, `date`, `mealType`, `availableCount`, `availabilityRatio`를 제공한다.
10. `availabilityRatio`는 `availableCount`를 `aggregates.participantCount`로 나눈 값이며, 추가 `totalResponses` 필드는 제공하지 않는다.
11. `aggregates.participantCount`는 전체 응답 제출자 수를 나타낸다.
12. 응답 본문에는 별도의 `slots` 배열이나 `metadata` 객체가 포함되지 않는다.
13. API는 이메일이나 전화번호 등 민감 정보를 반환하지 않는다.
14. `404` 오류는 약속 미존재 시 `APPOINTMENT_NOT_FOUND` 코드를 포함한 메시지를 반환한다.
15. `503` 오류는 템플릿 로딩 실패 등 일시적 문제 시 `SERVICE_UNAVAILABLE` 코드를 반환한다.
16. `500` 오류는 예기치 못한 서버 오류 시 `INTERNAL_ERROR` 코드를 반환한다.
17. 모든 오류 응답은 `{ "error": { "code": string, "message": string } }` 구조를 따른다.
18. 응답에는 닉네임 미등록 사용자 정보가 포함되지 않고, `participants` 배열에는 실제 응답 제출자만 노출된다.
