/**
 * 公開サインアップのサーバー側フィーチャーゲート。
 * 未設定や不正な値は fail-closed とし、明示的な `true` のみを有効化する。
 */
export function isPublicSignupEnabled(
  value: string | undefined = process.env.SIGNUP_ENABLED,
): boolean {
  return value?.trim().toLowerCase() === 'true'
}
