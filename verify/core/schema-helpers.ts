import { z } from 'zod'

/** zod 4のz.function()をobject schemaで使えないため、callback判定を共通化する。 */
export const fn = <T extends (...args: never[]) => unknown>() =>
  z.custom<T>(v => typeof v === 'function')

/** React.ReactNode 型 props 用 schema — schema verifier は vDOM を validate しない */
export const reactNode = () => z.any()
