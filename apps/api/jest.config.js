module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@reshit/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
    '^@reshit/shared/(.*)$': '<rootDir>/../../../packages/shared/src/$1',
  },
};
