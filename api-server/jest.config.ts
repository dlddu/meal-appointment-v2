import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.jest.json' }]
  },
  setupFilesAfterEnv: ['<rootDir>/tests/integration/jest.setup.ts']
};

export default config;
