# 식사 약속 조회 API 계약 체크리스트
1. (상태: 승인) 약속 조회 화면 데이터가 `GET /api/appointments/{appointmentId}/view` 단일 엔드포인트에서 제공되는지 확인한다.
2. (상태: 승인) 요청이 인증 헤더나 본문 없이 `Accept: application/json`만으로 처리되는지 확인한다.
3. (상태: 승인) 경로 변수 `appointmentId`가 공유 링크와 동일한 식별자를 사용하며 32자 이내 제약을 만족하는지 확인한다.
4. (상태: 승인) 서버가 추가 쿼리 파라미터 없이 모든 슬롯과 응답 데이터를 반환하는지 확인한다.
5. (상태: 반려 - metadata 섹션 제외) 응답 최상위에 `appointment`, `timeSlotTemplate`, `slotSummaries`, `participants`, `metadata` 섹션이 존재하는지 확인한다.
6. (상태: 승인) `appointment` 객체가 `id`, `title`, `summary`, `createdAt`, `updatedAt` 필드를 모두 포함하는지 확인한다.
7. (상태: 반려 - effectiveDateRange 제외) `timeSlotTemplate` 객체가 `id`, `name`, `description`, `rules`와 선택적 `effectiveDateRange`를 제공하는지 확인한다.
8. (상태: 반려 - meals 세부 정보 축소) `rules` 배열 항목이 `pattern`과 `meals` 리스트를 포함하고, 각 식사 항목이 `code`, `label`, `startTime`, `endTime`을 제공하는지 확인한다.
9. (상태: 반려 - effectiveDateRange 제외) `effectiveDateRange` 존재 시 `start`와 `end` ISO 날짜 문자열을 반환하는지 확인한다.
10. (상태: 반려 - 슬롯 표시 필드 축소) `slotSummaries` 요소가 `slotInstanceId`, `date`, `weekdayLabel`, `mealCode`, `mealLabel`을 포함하는지 확인한다.
11. (상태: 반려 - 집계 지표 조정) 각 슬롯 요약에 `availableCount`, `unavailableCount`, `noResponseCount`, `totalParticipants`, `availabilityRate`, 선택적 `lastUpdatedAt`이 포함되는지 확인한다.
12. (상태: 승인) `slotInstanceId`가 `YYYY-MM-DD_{mealCode}` 패턴으로 전달되는지 확인한다.
13. (상태: 반려 - PIN 여부 제외) `participants` 배열 항목이 `participantId`, `nickname`, `hasPin`, `responses`, `lastSubmittedAt`을 포함하는지 확인한다.
14. (상태: 반려 - 응답 값 단순화) 각 응답자의 `responses` 항목이 `slotInstanceId`, `isAvailable`, `submittedAt`을 담는지 확인한다.
15. (상태: 반려 - metadata 섹션 제외) `metadata` 객체가 `fetchedAt`과 `supportsRefresh`를 포함하고 필요 시 `notes` 배열을 제공하는지 확인한다.
16. (상태: 승인) 응답이 ISO 8601 날짜/시간 형식을 사용해 JSON으로 제공되는지 확인한다.
17. (상태: 승인) 오류 시 `404`, `503`, `500` 상태 코드와 `error`, `message` 필드를 포함한 JSON이 반환되는지 확인한다.
18. (상태: 승인) `updatedAt`과 `slotSummaries[].lastUpdatedAt`이 최신 응답 반영을 위해 갱신되는지 확인한다.
19. (상태: 반려 - PIN 여부 제외) 응답에 닉네임과 PIN 설정 여부만 포함되고 PIN 값 등 추가 개인정보가 제외되는지 확인한다.
20. (상태: 반려 - 과도한 요구사항) 불필요한 내부 식별자를 숨기고 외부 공유용 식별자만 노출하는지 확인한다.
21. (상태: 반려 - 범위 축소) `include` 쿼리, 다중 기간, 참여자 분리 등 확장 지점이 문서화되어 있는지 확인한다.

22. (상태: 승인) 응답 최상위에 `appointment`, `timeSlotTemplate`, `slotSummaries`, `participants` 섹션만 존재하는지 확인한다.
23. (상태: 승인) `timeSlotTemplate` 객체가 `id`, `name`, `description`, `rules`만 제공하고 추가 날짜 범위 정보는 제외되는지 확인한다.
24. (상태: 승인) `rules` 배열의 각 식사 항목이 `code`만 제공하도록 단순화되어 있는지 확인한다.
25. (상태: 승인) `slotSummaries` 요소가 `slotInstanceId`, `date`, `mealCode`를 포함하는지 확인한다.
26. (상태: 승인) 각 슬롯 요약에 `availableCount`, `noResponseCount`, `totalParticipants`, 선택적 `lastUpdatedAt`만 포함되는지 확인한다.
27. (상태: 승인) `availableCount`가 해당 슬롯에 응답한 참여자 수, `noResponseCount`가 아직 응답하지 않은 참여자 수로 집계되는지 확인한다.
28. (상태: 승인) `participants` 배열 항목이 `participantId`, `nickname`, `responses`, `lastSubmittedAt`을 포함하는지 확인한다.
29. (상태: 승인) 각 응답자의 `responses` 항목이 `slotInstanceId`, `submittedAt`만을 담는지 확인한다.
