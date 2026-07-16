import { expect, test } from '@playwright/test'

test('Create は Content Type が空の場合に Settings への導線を表示する', async ({ context, page }) => {
  await context.addCookies([{
    name: '__session',
    value: 'content-types-runtime-e2e',
    url: 'http://localhost:3000',
  }])
  await page.goto('/verify/CreateContentTypes/e2e-empty-workspace?chrome=0')

  await expect(page.getByRole('heading', { name: 'No Content Types configured' })).toBeVisible()
  await page.getByRole('link', { name: 'Open Content Type settings' }).click()
  await expect(page).toHaveURL(/\/settings$/)
})

test('Create は routing code の競合を検出して form を選択しない', async ({ page }) => {
  await page.goto('/verify/CreateContentTypes/e2e-conflicting-routing-codes?chrome=0')

  await expect(page.getByRole('heading', { name: 'Content Type configuration needs attention' })).toBeVisible()
  await expect(page.getByText(/Conflicting Content Type codes found/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Generate/ })).toHaveCount(0)
})

test('Resync は active Content Type を sort 順に code で routing する', async ({ page }) => {
  await page.goto('/verify/ResyncCards/e2e-workspace-content-types?chrome=0')

  const select = page.getByRole('combobox', { name: 'Content type' })
  await expect(select.locator('option')).toHaveText(['All', 'Language', 'IT'])
  expect(await select.locator('option').evaluateAll(options => (
    options.map(option => option.getAttribute('value'))
  ))).toEqual(['', 'form_language', 'form_it'])
  await expect(page.getByRole('button', { name: 'Re-sync cards' })).toBeDisabled()
})

test('Resync は routing code の競合時に実行を無効化する', async ({ page }) => {
  await page.goto('/verify/ResyncCards/e2e-conflicting-routing-codes?chrome=0')

  await expect(page.getByText(/Conflicting Content Type codes found/)).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Content type' }).locator('option')).toHaveText(['All'])
  await expect(page.getByRole('button', { name: 'Re-sync cards' })).toBeDisabled()
})
