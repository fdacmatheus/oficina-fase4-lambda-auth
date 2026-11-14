module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts'],
  coverageThreshold: {
    global: { branches: 95, functions: 95, lines: 95, statements: 95 },
  },
};
