module.exports = {
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    // @swc/jest reuses the compiler already installed (@swc/core). The
    // explicit jsc block is required for NestJS DI: Test.createTestingModule
    // resolves constructor dependencies from decorator metadata, which SWC
    // only emits when legacyDecorator + decoratorMetadata are on.
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true }
        }
      }
    ]
  },
  moduleFileExtensions: ['js', 'json', 'ts']
};
