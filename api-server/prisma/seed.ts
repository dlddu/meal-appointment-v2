// Implemented for spec: agent/specs/meal-appointment-local-testing-spec.md

import { PrismaClient } from '@prisma/client';
import { demoTemplate } from '../src/domain/templateEngine';

const prisma = new PrismaClient();

const defaultWeeklyTemplate = {
  id: 'default_weekly',
  name: '주간 기본 템플릿',
  description: '평일 저녁과 주말 점심/저녁을 포함한 기본 템플릿',
  rulesetJson: [
    { dayPattern: 'WEEKDAY', mealTypes: ['DINNER'] },
    { dayPattern: 'WEEKEND', mealTypes: ['LUNCH', 'DINNER'] }
  ]
};

async function main() {
  await prisma.timeSlotTemplate.upsert({
    where: { id: defaultWeeklyTemplate.id },
    update: {
      name: defaultWeeklyTemplate.name,
      description: defaultWeeklyTemplate.description,
      rulesetJson: defaultWeeklyTemplate.rulesetJson
    },
    create: defaultWeeklyTemplate
  });

  await prisma.timeSlotTemplate.upsert({
    where: { id: demoTemplate.id },
    update: {
      name: demoTemplate.name,
      description: 'Seeded demo template',
      rulesetJson: demoTemplate.rules as any
    },
    create: {
      id: demoTemplate.id,
      name: demoTemplate.name,
      description: 'Seeded demo template',
      rulesetJson: demoTemplate.rules as any
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
