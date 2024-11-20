module.exports = {
  // A map from regular expressions to module names that allow to stub out resources with a single module
  moduleNameMapper: {
    '^@helpers/(.*)$': '<rootDir>/helpers/$1',
    '^@mocks/(.*)$': '<rootDir>/__mocks__/$1',
    '^@plugins/(.*)$': '<rootDir>/$1',
    '^@templating/(.*)$': '<rootDir>/np.Templating/lib/$1',
    '^@templatingModules/(.*)$': '<rootDir>/np.Templating/lib/support/modules/$1',
    '^NPTemplating/(.*)$': '<rootDir>/np.Templating/lib/NPTemplating',
    '^TemplatingEngine/(.*)$': '<rootDir>/np.Templating/lib/TemplatingEngine',
    '^NPGlobals/(.*)$': '<rootDir>/np.Globals/lib/NPGlobals',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  testPathIgnorePatterns: ['<rootDir>/src/templates/np.plugin.starter', '<rootDir>/.history/'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest', // Handle .js, .jsx, .ts, .tsx files
    '^.+\\.mjs$': 'babel-jest', // Use babel-jest for .mjs files as well
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(node-notifier|uuid|lodash-es)/)', // Ensure these modules are transformed
  ],
}
