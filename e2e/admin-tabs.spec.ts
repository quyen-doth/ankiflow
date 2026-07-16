import { expect, test } from '@playwright/test'

const EXPECTED_TABS = [
  'Categories',
  'Card Types',
  'Topics',
  'Decks',
  'Content Types',
]

test('Admin は Notifications を除く 5 tab を表示し、旧 deep link を Categories に戻す', async ({
  context,
  page,
}) => {
  await context.addCookies([{
    name: '__session',
    value: 'admin-tabs-e2e',
    url: 'http://localhost:3000',
  }])

  await page.goto('/admin?tab=notifications')

  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveText(EXPECTED_TABS)
  await expect(page.getByRole('tab', { name: 'Notifications' })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Categories' })).toHaveAttribute('aria-selected', 'true')
})
