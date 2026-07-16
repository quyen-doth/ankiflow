import { expect, test } from '@playwright/test'

test('Create の New Topic modal は名前だけで Topic を作成して閉じる', async ({ page }) => {
  await page.goto('/verify/NewTopicModal/e2e-create-success?chrome=0')

  await expect(page.getByRole('heading', { name: 'New Topic' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Topic name' }).fill('Distributed Systems')
  await page.getByRole('button', { name: 'Create topic' }).click()

  await expect(page.getByRole('heading', { name: 'New Topic' })).toBeHidden()
  await expect(page.getByRole('status', { name: 'Created topic' })).toHaveText('Distributed Systems')
})

test('Topic 保存失敗時は modal と入力値を維持して再試行できる', async ({ page }) => {
  await page.goto('/verify/NewTopicModal/e2e-create-error?chrome=0')

  const input = page.getByRole('textbox', { name: 'Topic name' })
  await input.fill('Cloud Security')
  await page.getByRole('button', { name: 'Create topic' }).click()

  await expect(page.getByRole('heading', { name: 'New Topic' })).toBeVisible()
  await expect(input).toHaveValue('Cloud Security')
  await expect(page.getByText('Failed to create the topic. Please try again.')).toBeVisible()
})
