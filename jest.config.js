module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: [
    './node_modules/react-native-gesture-handler/jestSetup.js',
    './jest.setup.js',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // lucide's `react-native` export is ESM (.mjs), which babel-jest doesn't
    // transform by default; use its CommonJS build under Jest.
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  // Several packages ship untranspiled ESM under their `react-native` export
  // condition (react-native-size-matters, and the Redux family — immer,
  // react-redux, RTK); let Babel transform them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(-.*)?|@react-native(-community)?|@react-navigation|immer|redux|redux-thunk|reselect|react-redux|@reduxjs|use-sync-external-store)/)',
  ],
};
