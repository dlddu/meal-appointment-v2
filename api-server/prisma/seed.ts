// Implemented for spec: agent/specs/meal-appointment-local-testing-spec.md

import prisma from '../src/infrastructure/prismaClient';
import { demoTemplate } from '../src/domain/templateEngine';

async function main() {
  await prisma.$connect();

  await prisma.query(
    `INSERT OR REPLACE INTO time_slot_templates (id, name, description, ruleset_json)
     VALUES (?, ?, ?, ?)`,
    [
      'default_weekly',
      '주간 기본 템플릿',
      '평일 저녁과 주말 점심/저녁을 포함한 기본 템플릿',
      JSON.stringify([
        { dayPattern: 'WEEKDAY', mealTypes: ['DINNER'] },
        { dayPattern: 'WEEKEND', mealTypes: ['LUNCH', 'DINNER'] }
      ])
    ]
  );

  await prisma.query(
    `INSERT OR REPLACE INTO time_slot_templates (id, name, description, ruleset_json)
     VALUES (?, ?, ?, ?)`,
    [
      demoTemplate.id,
      demoTemplate.name,
      'Seeded demo template',
      JSON.stringify(demoTemplate.rules)
    ]
  );

  console.log('[seed] Database seeded successfully.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
