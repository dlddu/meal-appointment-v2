// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md

import type { TemplateOption } from './types.js';

export const createAppointmentTemplateOptions: TemplateOption[] = [
  {
    id: 'default_weekly',
    title: '주간 기본 템플릿',
    description: '월~금, 11:30 - 13:30',
    badge: '기본 제공'
  },
  {
    id: 'weekend_brunch',
    title: '주말 브런치 템플릿',
    description: '토~일, 10:00 - 12:00',
    badge: '준비 중',
    disabled: true
  }
];

export const createAppointmentStrings = {
  hero: {
    title: '함께 식사할 약속을 만들어보세요',
    subtitle: '기본 템플릿으로 일정 후보를 공유하고 참여자와 빠르게 합의하세요.'
  },
  form: {
    sectionTitle: '약속 정보 입력',
    titleLabel: '약속 제목',
    titlePlaceholder: '예) 금요일 사무실 근처 점심',
    summaryLabel: '약속 소개',
    summaryPlaceholder: '참여자에게 안내할 내용을 입력하세요.',
    summaryHelper: '필수는 아니지만 간단한 설명을 남기면 좋아요.',
    sectionHelper: '필수 정보를 작성하면 공유 가능한 링크를 드려요.',
    templateLabel: '시간 슬롯 템플릿 선택',
    templateHint: '한 번에 하나만 선택할 수 있어요.',
    submit: '약속 만들기',
    submitting: '생성 중...',
    templateUnavailable: '아직 준비 중인 템플릿입니다.',
    summaryRemaining: (count: number) => `남은 글자 수 ${count}자`,
    summaryExceeded: (count: number) => `${count}자를 초과했어요.`,
    titleRequired: '제목을 입력해주세요.',
    titleTooLong: '제목은 60자 이하로 입력해주세요.',
    templateRequired: '템플릿을 선택해주세요.',
    summaryTooLong: '설명은 200자 이하로 입력해주세요.',
    templateSelectedLabel: '선택됨',
    templateDisabledLabel: '잠시 후 이용 가능'
  },
  success: {
    sectionTitle: '공유 준비 완료',
    headline: '링크가 준비되었어요!',
    body: '약속 링크를 복사해서 초대해보세요.',
    copyButton: '링크 복사하기',
    copying: '복사 중...',
    copiedToast: '클립보드에 복사되었습니다.',
    copyFailed: '링크 복사에 실패했습니다. 잠시 후 다시 시도해주세요.',
    viewDetails: '약속 세부 정보 열기',
    shareLabel: '공유 링크'
  },
  banners: {
    serverError: '일시적인 문제로 약속을 생성할 수 없습니다. 잠시 후 다시 시도하세요.',
    networkError: '네트워크 연결을 확인한 뒤 다시 시도해주세요.',
    retry: '다시 시도'
  },
  accessibility: {
    formRegion: '약속 생성 폼',
    templateGroupLabel: '시간 슬롯 템플릿 라디오 그룹'
  },
  footer: {
    note: '이 화면은 식사 약속 조율 프로토타입입니다.'
  }
} as const;

export type CreateAppointmentStrings = typeof createAppointmentStrings;
