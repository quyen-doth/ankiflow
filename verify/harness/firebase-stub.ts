/** vitestでFirebase client初期化を避けるため、alias先には空のdb/authだけを公開する。 */
export const db = {} as Record<string, never>
export const auth = {} as Record<string, never>
