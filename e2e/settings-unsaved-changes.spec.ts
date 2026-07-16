import { expect, test } from '@playwright/test'

test('未保存変更の内部遷移で保持または破棄を選択できる', async ({ page }) => {
  await page.goto('/verify/UnsavedChangesGuard/dirty?chrome=0')

  await page.getByRole('link', { name: 'Leave page' }).click()
  await expect(page.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible()
  await page.getByRole('button', { name: 'Keep editing' }).click()
  await expect(page.getByRole('heading', { name: 'Unsaved changes' })).toBeHidden()
  await expect(page).toHaveURL(/\/verify\/UnsavedChangesGuard\/dirty\?chrome=0$/)

  await page.getByRole('link', { name: 'Leave page' }).click()
  await page.getByRole('button', { name: 'Discard changes' }).click()
  await expect(page).toHaveURL(/\/verify\/Modal\/open-basic\?chrome=0$/)
})

test('未保存変更がある場合は reload で native dialog を表示する', async ({ page }) => {
  await page.goto('/verify/UnsavedChangesGuard/dirty?chrome=0')
  await page.getByRole('button', { name: 'Edit setting' }).click()

  let dialogType = ''
  page.once('dialog', async dialog => {
    dialogType = dialog.type()
    await dialog.accept()
  })

  await page.reload()
  expect(dialogType).toBe('beforeunload')
})
