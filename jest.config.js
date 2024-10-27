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
    '\\.css$': 'identity-obj-proxy', // Mock CSS modules
  },
  testPathIgnorePatterns: ['<rootDir>/src/templates/np.plugin.starter', '<rootDir>/.history/'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  testEnvironment: 'jsdom', // Use jsdom for React/DOM-related tests
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
}
