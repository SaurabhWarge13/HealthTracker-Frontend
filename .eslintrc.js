module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // Jest globals are only in scope for the setup file and the suites.
      files: ['jest.setup.js', '__tests__/**/*'],
      env: { jest: true },
    },
  ],
};
