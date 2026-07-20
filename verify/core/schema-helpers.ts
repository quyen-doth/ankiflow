import { z } from 'zod'

/**
 * Schema cho callback props (onChange, onRemove...).
 * 検証用コメント。
 * 検証用コメント。
 */
export const fn = <T extends (...args: never[]) => unknown>() =>
  z.custom<T>(v => typeof v === 'function')

/** React.ReactNode 型 props 用 schema — schema verifier は vDOM を validate しない */
export const reactNode = () => z.any()
