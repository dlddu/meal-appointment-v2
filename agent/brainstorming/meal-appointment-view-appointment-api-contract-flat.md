# 식사 약속 조회 API 계약 평탄화
1. 공개 링크 기반 약속 조회 화면은 `GET /api/appointments/{appointmentId}/view` 단일 엔드포인트로 모든 데이터를 수집한다.
2. 요청에는 인증 헤더나 본문이 없고 `Accept: application/json` 정도만 명시하면 된다.
3. 경로 변수 `appointmentId`는 공유 링크와 동일한 문자열 식별자를 사용하며 32자 이내를 가정한다.
4. 서버는 템플릿 규칙에 따라 모든 슬롯과 응답을 포함해 반환하고 추가 쿼리 파라미터는 허용하지 않는다.
5. 응답 최상위에는 `appointment`, `timeSlotTemplate`, `slotSummaries`, `participants`, `metadata` 섹션이 존재해야 한다.
6. `appointment` 객체는 `id`, `title`, `summary`, `createdAt`, `updatedAt` 필드를 포함한다.
7. `timeSlotTemplate` 객체는 `id`, `name`, `description`, `rules`, 선택적 `effectiveDateRange`를 제공한다.
8. `rules` 배열 항목은 `pattern`과 `meals` 목록을 포함하며 각 식사 항목은 `code`, `label`, `startTime`, `endTime`을 제공한다.
9. `effectiveDateRange`가 있을 경우 `start`와 `end` ISO 날짜 문자열을 포함해 슬롯 생성 기간을 설명한다.
10. `slotSummaries` 배열의 각 요소는 파생된 슬롯 식별 정보(`slotInstanceId`, `date`, `weekdayLabel`, `mealCode`, `mealLabel`)를 제공한다.
11. 슬롯 요약에는 `availableCount`, `unavailableCount`, `noResponseCount`, `totalParticipants`, `availabilityRate`, 선택적 `lastUpdatedAt`이 포함된다.
12. `slotInstanceId`는 `YYYY-MM-DD_{mealCode}` 패턴을 따른다.
13. `participants` 배열은 응답자 세션 목록을 제공하며 각 항목은 `participantId`, `nickname`, `hasPin`, `responses`, `lastSubmittedAt`을 포함한다.
14. 각 응답자의 `responses` 항목은 `slotInstanceId`, `isAvailable`, `submittedAt`을 담는다.
15. `metadata` 객체는 최소 `fetchedAt`과 `supportsRefresh`를 포함하고 필요 시 안내 메시지를 위한 `notes` 배열을 제공한다.
16. 서버는 응답 예시처럼 JSON을 반환하며 ISO 8601 날짜/시간 형식을 사용한다.
17. 오류 상황에서는 `404`, `503`, `500` 상태 코드와 표준화된 `error`, `message` 필드를 가진 JSON을 반환한다.
18. 서버는 `updatedAt`과 `slotSummaries[].lastUpdatedAt`을 통해 최신 상태를 전달하며 응답 제출 시 즉시 갱신해야 한다.
19. 응답에는 닉네임과 PIN 설정 여부만 포함하고 PIN 값이나 추가 개인정보는 제외한다.
20. 내부 DB 기본 키 등 불필요한 식별자는 숨기고 외부 공유용 식별자만 노출한다.
21. 향후 확장을 위해 `include` 쿼리, 다중 기간 지원, 참여자 목록 분리 등 확장 지점이 존재함을 문서화한다.
