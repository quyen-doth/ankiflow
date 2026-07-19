import { expect, test } from '@playwright/test'
import { isPublicSignupEnabled } from '../lib/signup-policy'

const signupEnabled = isPublicSignupEnabled()
const testBaseUrl = process.env.SIGNUP_TEST_BASE_URL?.replace(/\/$/, '') ?? ''
const testUrl = (path: string) => `${testBaseUrl}${path}`

test('公開 signup の UI が server configuration と一致する', async ({ page }) => {
  await page.goto(testUrl('/login'))
  const createAccountLink = page.getByRole('link', { name: 'Create account' })

  if (signupEnabled) {
    await expect(createAccountLink).toBeVisible()
  } else {
    await expect(createAccountLink).toHaveCount(0)
  }

  await page.goto(testUrl('/signup'))
  if (signupEnabled) {
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
  } else {
    await expect(page.getByRole('heading', { name: 'Sign-ups are currently closed' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible()
    await expect(page.locator('form')).toHaveCount(0)
  }
})

test('無効時の signup API は Firebase に到達する前に 403 を返す', async ({ request }) => {
  test.skip(signupEnabled, 'This guard assertion only applies while public signup is disabled.')

  const response = await request.post(testUrl('/api/auth/signup'), {
    headers: { 'Content-Type': 'application/json' },
    data: 'not-json',
  })

  expect(response.status()).toBe(403)
  expect(await response.json()).toEqual({ error: 'Sign-ups are currently closed' })
})

test('cookie だけ残った signed-out session は削除して login に戻す', async ({
  context,
  page,
}) => {
  await page.goto(testUrl('/login'))
  await context.addCookies([
    {
      name: '__session',
      value: 'stale-session-cookie',
      url: new URL(page.url()).origin,
    },
  ])

  await page.goto(testUrl('/dashboard'))

  await expect(page).toHaveURL(/\/login$/)
  await expect
    .poll(async () => {
      const cookies = await context.cookies()
      return cookies.some((cookie) => cookie.name === '__session')
    })
    .toBe(false)
})
