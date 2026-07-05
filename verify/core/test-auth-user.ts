/**
 * User giả dùng xuyên suốt verify harness — tách riêng KHÔNG import gì khác để
 * `verify/test-setup.ts` (setupFile, chạy trước mọi test file) import được mà
 * KHÔNG kéo theo chuỗi AuthProvider.tsx → 'firebase/auth' (thật), vốn sẽ đóng băng
 * binding thật trước khi `vi.mock('firebase/auth', ...)` của từng test file kịp áp dụng.
 */
export const TEST_AUTH_USER = { uid: 'test-user', email: 'test@ankiflow.local' } as const
