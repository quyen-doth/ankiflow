import { expect, test } from '@playwright/test'

test.describe('LINE notification mobile linking', () => {
  test('mobile は pre-filled send link と copy feedback を表示する', async ({ context, page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://localhost:3000',
    })
    await page.goto('/verify/LineNotificationSettings/code-ready?chrome=0')

    await expect(page.getByText('ANKI-ABCDEF', { exact: true })).toBeVisible()
    await expect(page.getByText('Waiting for your message in LINE…')).toBeVisible()

    const sendLink = page.getByRole('link', { name: 'Open LINE & send code' })
    await expect(sendLink).toBeVisible()
    await expect(sendLink).toHaveAttribute(
      'href',
      'https://line.me/R/oaMessage/%40ankiflow/?ANKI-ABCDEF',
    )

    await page.getByRole('button', { name: 'Copy' }).click()
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toBeVisible()
  })

  test('desktop は send deep link を隠して copy を維持する', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/verify/LineNotificationSettings/code-ready?chrome=0')

    await expect(page.getByRole('link', { name: 'Open LINE & send code' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible()
  })

  test('bot config がない場合も明示的な fallback を表示する', async ({ page }) => {
    await page.goto('/verify/LineNotificationSettings/probe-missing-bot-config?chrome=0')

    await expect(page.getByText('LINE bot link is not configured.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Generate code' })).toBeVisible()
  })
})
