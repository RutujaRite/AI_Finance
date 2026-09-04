/*
 * Testing Configuration for Node.js Login Direct Application
 * 
 * This file configures the testing setup for the entire application,
 * including unit tests, integration tests, and component tests.
 * 
 * Run commands:
 * - npm test                    - Run all tests
 * - npm run test:unit           - Run only unit tests
 * - npm run test:integration     - Run only integration tests
 * - npm run test:component       - Run only component tests
 * - npm run test:e2e             - Run only end-to-end tests
 * - npm run test:coverage          - Run tests with coverage report
 * - npm run test:watch            - Run tests in watch mode
 * 
 * Test Coverage Configuration:
 * - Code coverage threshold: 80%
 * - Uses Jest testing framework
 * - Supports both Node.js and browser environments
 * - Includes mocking for API calls, database connections, etc.
 */

const path = require('path');

module.exports = {
  // Global setup configuration
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Test root directory configuration
  rootDir: path.resolve(__dirname, '..'),

  // Test environment configuration
  testEnvironment: 'node',

  // Setup test modules
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@pages/(.*)$': '<rootDir>/app/$1',
    '^@styles/(.*)$': '<rootDir>/public/$1',
  },

  // Module resolution configuration
  moduleDirectories: ['node_modules', 'src'],

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.{js,ts,jsx,tsx}',
    '<rootDir>/**/*.{test,spec}.{js,ts,jsx,tsx}',
  ],

  // Test transformation configuration
  transform: {
    '^.+\\.(js|ts|tsx|jsx)$': [
      'babel-jest',
      {
        presets: [
          [
            '@babel/preset-env',
            {
              targets: { node: 'current' },
              modules: false,
            },
          ],
          '@babel/preset-typescript',
          '@babel/preset-react',
        ],
      },
    ],
  },

  // Module file extensions
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],

  // Test timeout configuration
  testTimeout: 30000,

  // Collect coverage from these directories
  collectCoverageFrom: [
    '**/*.{js,ts,jsx,tsx}',
    '!**/node_modules/**',
    '!**/.git/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/dist/**',
    '!**/build/**',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'services/companySelectionService.js': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Setup test globals
  setupFiles: ['<rootDir>/tests/setup.js'],

  // Snapshot configuration
  snapshotSerializers: ['@emotion/jest'],

  // Verbose test output configuration
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Collect coverage on change
  collectCoverageOnChange: true,

  // Coverage report configuration
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'html', 'json'],

  // Test watch configuration
  watchPlugins: ['jest-watch-typeahead'],
  watch: true,

  // Error handling configuration
  bail: false,
  errorOnUnmatchedPattern: false,
  forceExit: true,

  // Performance configuration
  maxWorkers: '50%',
  minWorkers: 1,

  // Configuration for different test environments
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/coverage/',
    '<rootDir>/node_modules/',
    '<rootDir>/tmp/',
  ],

  // Configuration for global setup/teardown
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',

  // Configuration for JSON imports
  resolver: path.resolve(__dirname, './tests/resolver.js'),

  // Plugin configuration
  plugins: [
    'jest-plugin-transform-stub',
    'jest-html-reporters',
  ],

  // Custom test configuration
  customTestMatcher: path.resolve(__dirname, './tests/testMatcher.js'),

  // Logger configuration
  logLevel: 'info',
  reporter: 'default',

  // Configuration for running tests in specific order
  testRunner: 'jest-runner',

  // Configuration for test retry
  maxRetries: 2,
  retry: true,

  // Configuration for test isolation
  testIsolation: {
    enabled: true,
    environment: 'isolated',
  },

  // Configuration for performance monitoring
  monitor: true,

  // Configuration for test worker lifecycle
  workerThreads: true,
};