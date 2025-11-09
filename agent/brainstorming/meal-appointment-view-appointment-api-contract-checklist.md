# 식사 약속 조회 API 계약 체크리스트
1. (상태: 승인) GET `/api/appointments/{appointmentId}`가 인증 없이 JSON 응답을 반환하는지 확인한다.
2. (상태: 반려 - 쿼리 파라미터를 허용하지 않음) `appointmentId` 경로 변수와 선택적 `timezone` 쿼리 파라미터를 지원하는지 확인한다.
3. (상태: 반려 - `slots`, `metadata` 필드를 제외함) 성공 응답이 `appointment`, `template`, `slots`, `participants`, `aggregates`, `metadata` 필드를 모두 포함하는지 확인한다.
4. (상태: 승인) `appointment` 객체에 `id`, `title`, `summary`, `createdAt`, `updatedAt`, `timeSlotTemplateId`가 포함되어 있는지 확인한다.
5. (상태: 반려 - 규칙 전체 데이터를 제공하며 `label`을 노출하지 않음) `template` 객체가 템플릿 기본 정보와 각 규칙 요약(`dayPattern`, `mealType`, `label`)을 제공하는지 확인한다.
6. (상태: 반려 - 응답 본문에서 `slots` 배열을 제거함) `slots` 항목이 `slotKey`, `start`, `end`, `dateLabel`, `mealLabel`, `templateRuleRef` 필드를 포함하는지 확인한다.
7. (상태: 반려 - `slotKey`는 날짜와 `mealType` 조합으로 정의함) `slotKey`가 날짜와 식사 시간대를 조합한 안정적 식별자이며 `start`/`end`가 타임존 반영 ISO-8601 문자열인지 확인한다.
8. (상태: 승인) `participants` 배열이 `participantId`, `nickname`, `submittedAt`, `responses`를 노출하는지 확인한다.
9. (상태: 반려 - `isAvailable`을 제외하고 선택한 슬롯만 응답에 포함함) 각 `responses` 항목이 `slotKey`와 `isAvailable` 불리언을 포함하고 미선택 슬롯이 `false`로 저장되는지 확인한다.
10. (상태: 반려 - `totalResponses` 없이 `availabilityRatio`를 `participantCount` 기준으로 계산함) `aggregates.slotSummaries`가 `slotKey`, `totalResponses`, `availableCount`, `availabilityRatio`를 제공하는지 확인한다.
11. (상태: 승인) `aggregates.participantCount`가 전체 응답 제출자 수를 나타내는지 확인한다.
12. (상태: 반려 - 별도 `metadata` 객체를 반환하지 않음) `metadata`가 `refreshedAt`, `timezone`, `readOnly(true)`, `shareUrl` 값을 포함하는지 확인한다.
13. (상태: 반려 - `slots` 배열이 없어 동일 키 집합 조건이 사라짐) `slots`와 `aggregates.slotSummaries`가 동일한 `slotKey` 집합을 공유하는지 확인한다.
14. (상태: 승인) API 응답이 이메일이나 전화번호 등 민감 정보를 제외하는지 확인한다.
15. (상태: 반려 - `refreshedAt` 필드를 제공하지 않음) `refreshedAt` 필드가 최신 데이터 판단 및 새로고침 안내에 활용될 수 있도록 제공되는지 확인한다.
16. (상태: 승인) 약속 미존재 시 `404`와 `APPOINTMENT_NOT_FOUND` 오류 본문을 반환하는지 확인한다.
17. (상태: 승인) 템플릿 로딩 실패 등 일시적 문제 시 `503`과 `SERVICE_UNAVAILABLE` 오류 본문을 반환하는지 확인한다.
18. (상태: 승인) 예기치 못한 서버 오류 시 `500`과 `INTERNAL_ERROR` 오류 본문을 반환하는지 확인한다.
19. (상태: 승인) 모든 오류 응답이 `{ "error": { "code": string, "message": string } }` 구조를 따르는지 확인한다.
20. (상태: 승인) 응답에 닉네임 미등록 사용자 정보가 포함되지 않고 `participants` 배열이 실제 응답 제출자만 노출하는지 확인한다.
21. (상태: 승인) 경로 변수 `appointmentId`만 사용하며 추가 쿼리 파라미터를 허용하지 않는지 확인한다.
22. (상태: 승인) 성공 응답 최상위 객체가 `appointment`, `template`, `participants`, `aggregates`로 제한되는지 확인한다.
23. (상태: 반려 - `ruleId`를 노출하지 않음) `template.rules`가 규칙의 원본 속성(`ruleId`, `dayPattern`, `mealTypes` 등)을 요약 없이 그대로 노출하는지 확인한다.
24. (상태: 승인) `responses` 목록에 선택된 슬롯의 `slotKey`만 포함되고 미선택 슬롯이 누락되는지 확인한다.
25. (상태: 승인) `slotKey`가 `YYYY-MM-DD#MEALTYPE` 형식으로 날짜와 규칙의 `mealType`을 결합해 안정적으로 생성되는지 확인한다.
26. (상태: 승인) `aggregates.slotSummaries`가 `slotKey`, `date`, `mealType`, `availableCount`, `availabilityRatio`만 포함하는지 확인한다.
27. (상태: 승인) `availabilityRatio`가 `availableCount / participantCount` 계산 결과와 일치하며 `totalResponses`가 추가로 노출되지 않는지 확인한다.
28. (상태: 승인) `template.rules`가 `dayPattern`과 `mealTypes` 원본 속성만 노출하고 `ruleId`를 포함하지 않는지 확인한다.
