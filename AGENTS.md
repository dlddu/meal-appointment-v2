# 작업 유형 안내

이 저장소의 작업 요청은 다음 네 가지 유형으로 분류합니다. 요청을 처리하기 전에 현재 작업이 어느 유형에 속하는지 판단하고, 해당 유형의 추가 지침을 확인하십시오.

1. **브레인스토밍 작업** – 세부 지침: `agent/brainstorming/AGENTS.md`
2. **명세 작성 작업** – 세부 지침: `agent/specs/AGENTS.md`
3. **구현 작업** – 세부 지침: `agent/implementation/AGENTS.md`
4. **그 외의 작업** – 별도 AGENTS 지침이 없으며, 일반적인 시스템/사용자 지시를 따릅니다.

요청이 위 목록 중 특정 유형으로 분류되면 반드시 해당 경로의 AGENTS 파일을 추가로 확인한 뒤 작업을 진행하십시오. 여러 유형이 겹치는 경우, 보다 구체적인 지침부터 우선적으로 적용합니다.

## 명세와 구현 산출물 간 일관성 유지
- 명세(`agent/specs/*`)와 관련 인덱스(`agent/indexes/spec-index.json`, `agent/indexes/spec-reference-index.json`)는 서로 참조 관계가 맞도록 항상 동기화해야 합니다.
- 구현 결과물은 관련 명세와 1:1로 대응해야 하며, 구현 후 `agent/indexes/implementation-index.json`에 대응 관계를 기록합니다.
- 명세 또는 구현을 수정할 때에는 해당 인덱스 파일을 함께 검토하여 최신 상태가 유지되도록 합니다.
