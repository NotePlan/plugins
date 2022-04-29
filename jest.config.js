module.exports = {
  // A map from regular expressions to module names that allow to stub out resources with a single module
  moduleNameMapper: {
    '^@helpers/(.*)$': '<rootDir>/helpers/$1',
    '^@plugins/(.*)$': '<rootDir>/$1',
    '^@templating/(.*)$': '<rootDir>/np.Templating/lib/$1',
    '^@templatingModules/(.*)$': '<rootDir>/np.Templating/lib/support/modules/$1',
    '^NPTemplating/(.*)$': '<rootDir>/np.Templating/lib/NPTemplating',
    '^TemplatingEngine/(.*)$': '<rootDir>/np.Templating/lib/TemplatingEngine',
    '^NPGlobals/(.*)$': '<rootDir>/np.Globals/lib/NPGlobals',
  },
}
