module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // zod v4 ships `export * as core from …`, which the RN preset does not
    // enable on its own — without this Metro fails to parse the package.
    '@babel/plugin-transform-export-namespace-from',
    [
      // Inlines `.env` into the bundle at build time as the `@env` module.
      // Because the values are baked in by Babel, editing `.env` needs
      // `yarn start --reset-cache` to take effect.
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        // `.env` is gitignored, so a fresh clone and CI have none. Letting the
        // keys come through as `undefined` keeps the failure ours to report:
        // src/config/env.ts says which key is wrong and how to fix it, instead
        // of Babel failing with a message about a module nobody wrote.
        safe: false,
        allowUndefined: true,
        // The banner in src/config/env.ts already reports the resolved URL,
        // and this one prints on every transform.
        quiet: true,
      },
    ],
    [
      'module-resolver',
      {
        root: ['./'],
        alias: { '@': './src' },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
  ],
};
