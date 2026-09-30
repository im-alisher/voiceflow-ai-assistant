/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testEnvironment: 'node',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
  },
};
