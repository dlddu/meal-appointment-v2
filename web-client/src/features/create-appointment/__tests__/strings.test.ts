// Tests for spec: agent/specs/meal-appointment-create-appointment-frontend-test-spec.md

import { describe, expect, it } from 'vitest';
import { createAppointmentStrings } from '../strings.js';

describe('createAppointmentStrings', () => {
  it('matches the approved Korean copy snapshot', () => {
    expect(createAppointmentStrings).toMatchInlineSnapshot(`
      {
        "accessibility": {
          "formRegion": "약속 생성 폼",
          "templateGroupLabel": "시간 슬롯 템플릿 라디오 그룹",
        },
        "banners": {
          "networkError": "네트워크 연결을 확인한 뒤 다시 시도해주세요.",
          "retry": "다시 시도",
          "serverError": "일시적인 문제로 약속을 생성할 수 없습니다. 잠시 후 다시 시도하세요.",
        },
        "footer": {
          "note": "이 화면은 식사 약속 조율 프로토타입입니다.",
        },
        "form": {
          "sectionHelper": "필수 정보를 작성하면 공유 가능한 링크를 드려요.",
          "sectionTitle": "약속 정보 입력",
          "submit": "약속 만들기",
          "submitting": "생성 중...",
          "summaryExceeded": [Function],
          "summaryHelper": "필수는 아니지만 간단한 설명을 남기면 좋아요.",
          "summaryLabel": "약속 소개",
          "summaryPlaceholder": "참여자에게 안내할 내용을 입력하세요.",
          "summaryRemaining": [Function],
          "summaryTooLong": "설명은 200자 이하로 입력해주세요.",
          "templateDisabledLabel": "잠시 후 이용 가능",
          "templateHint": "한 번에 하나만 선택할 수 있어요.",
          "templateLabel": "시간 슬롯 템플릿 선택",
          "templateRequired": "템플릿을 선택해주세요.",
          "templateSelectedLabel": "선택됨",
          "templateUnavailable": "아직 준비 중인 템플릿입니다.",
          "titleLabel": "약속 제목",
          "titlePlaceholder": "예) 금요일 사무실 근처 점심",
          "titleRequired": "제목을 입력해주세요.",
          "titleTooLong": "제목은 60자 이하로 입력해주세요.",
        },
        "hero": {
          "subtitle": "기본 템플릿으로 일정 후보를 공유하고 참여자와 빠르게 합의하세요.",
          "title": "함께 식사할 약속을 만들어보세요",
        },
        "success": {
          "body": "약속 링크를 복사해서 초대해보세요.",
          "copiedToast": "클립보드에 복사되었습니다.",
          "copyButton": "링크 복사하기",
          "copyFailed": "링크 복사에 실패했습니다. 잠시 후 다시 시도해주세요.",
          "copying": "복사 중...",
          "headline": "링크가 준비되었어요!",
          "sectionTitle": "공유 준비 완료",
          "shareLabel": "공유 링크",
          "viewDetails": "약속 세부 정보 열기",
        },
      }
    `);
  });
});
