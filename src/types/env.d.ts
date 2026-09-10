// Keys are optional on purpose: `.env` is gitignored, so a fresh clone has
// nothing behind them, and that forces `src/config/env.ts` to validate.
declare module '@env' {
  export const API_MODE: string | undefined;
  export const SERVER_URL: string | undefined;
  export const LOCAL_URL: string | undefined;
}
