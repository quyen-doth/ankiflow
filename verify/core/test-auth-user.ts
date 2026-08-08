/** test setupがFirebase実装を早期loadしないよう、依存ゼロの別moduleに隔離する。 */
export const TEST_AUTH_USER = { uid: 'test-user', email: 'test@ankiflow.local' } as const
