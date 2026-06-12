import { z } from 'zod'

/**
 * Schema cho callback props (onChange, onRemove...).
 * zod 4 đã đổi API z.function() — không còn dùng được như ZodType trong
 * object schema, nên chuẩn hóa toàn bộ specs qua helper này.
 */
export const fn = <T extends (...args: never[]) => unknown>() =>
  z.custom<T>(v => typeof v === 'function')

/** Schema cho props kiểu React.ReactNode — schema verifier không validate vDOM */
export const reactNode = () => z.any()
