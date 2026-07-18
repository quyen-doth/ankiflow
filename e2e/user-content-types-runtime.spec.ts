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

test('Create は routing code の競合だけ除外して残りの form を利用できる', async ({ page }) => {
  await page.goto('/verify/CreateContentTypes/e2e-conflicting-routing-codes?chrome=0')

  await expect(page.getByText(/Some Content Types share a routing code and were hidden/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Quiz' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Generate/ })).toBeVisible()
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

test('Resync は routing code の競合だけ除外して残りの type を表示する', async ({ page }) => {
  await page.goto('/verify/ResyncCards/e2e-conflicting-routing-codes?chrome=0')

  await expect(page.getByText(/Some Content Types share a routing code and were hidden/)).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Content type' }).locator('option')).toHaveText(['All', 'IT'])
  await expect(page.getByRole('button', { name: 'Re-sync cards' })).toBeDisabled()
})

test('Configured CardForm は persistent core field を session から復元する', async ({ page }) => {
  await page.goto('/verify/ConfiguredCardForm/persistent-field-hydrates?chrome=0')

  await expect(page.getByRole('textbox', { name: 'Audience' })).toHaveValue('Software engineers')
})

test('Configured CardForm は primary dropdown の型と options を保持する', async ({ page }) => {
  await page.goto('/verify/ConfiguredCardForm/primary-dropdown-renders-as-select?chrome=0')

  const select = page.getByRole('combobox', { name: 'Level' })
  await expect(select).toBeVisible()
  await expect(select.locator('option')).toHaveText(['Select…', 'Beginner', 'Advanced'])
})

test('Configured CardForm はすべての required field を検証する', async ({ page }) => {
  await page.goto('/verify/ConfiguredCardForm/probe-all-required-fields?chrome=0')

  await expect(page.getByText('Audience is required.')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Audience' })).toHaveAttribute('aria-invalid', 'true')
})

test('Configured CardForm は成功後 nonpersistent field だけを reset する', async ({ page }) => {
  await page.goto('/verify/ConfiguredCardForm/submit-resets-only-nonpersistent?chrome=0')

  await expect(page.getByRole('textbox', { name: 'Prompt' })).toHaveValue('')
  await expect(page.getByRole('textbox', { name: 'Audience' })).toHaveValue('Beginners')
})

test('Create generate payload は selected workspace content_type_id を送信する', async ({ page }) => {
  let generateBody: Record<string, unknown> | null = null

  await page.route('**/api/entries/check-duplicate', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ duplicates: [] }) })
  })
  await page.route('**/api/generate', async route => {
    generateBody = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: { word: 'Event loop', meaning_vi: 'Runtime scheduling' } }),
    })
  })

  await page.goto('/verify/CreateContentTypes/e2e-authoritative-payload?chrome=0')
  await page.getByRole('textbox', { name: 'Prompt' }).fill('Event loop')
  await page.getByRole('button', { name: /Generate/ }).click()

  await expect.poll(() => generateBody).not.toBeNull()
  expect(generateBody).toMatchObject({
    form_type: 'quiz',
    content_type_id: 'quiz-type__test-user',
    word: 'Event loop',
  })
})
