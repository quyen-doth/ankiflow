import { expect, test } from '@playwright/test'

test('Create は一時 output language を生成へ渡し、成功後に default へ戻す', async ({ page }) => {
  await page.goto('/verify/ConfiguredCardForm/e2e-output-language-control?chrome=0')

  const outputLanguage = page.getByRole('combobox', { name: 'Explanation language' })
  await expect(outputLanguage).toHaveValue('vi')
  await expect(outputLanguage.locator('option')).toHaveText([
    'Select output language...',
    'Vietnamese',
    'Japanese for explanations',
  ])

  await outputLanguage.selectOption('ja')
  await page.getByRole('textbox', { name: 'Prompt' }).fill('Explain closures')
  await page.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit())

  await expect.poll(async () => page.evaluate(() => {
    const raw = localStorage.getItem('ankiflow_pending_result')
    if (!raw) return null
    const pending = JSON.parse(raw) as {
      outputLanguage?: string
      generatedContent?: { generated_output_language?: string }
    }
    return {
      outputLanguage: pending.outputLanguage,
      generatedOutputLanguage: pending.generatedContent?.generated_output_language,
    }
  })).toEqual({
    outputLanguage: 'ja',
    generatedOutputLanguage: 'ja',
  })
  await expect(outputLanguage).toHaveValue('vi')
})

test('Custom Content Type の batch は一時 output language を全 item へ渡す', async ({ page }) => {
  await page.goto('/verify/ConfiguredCardForm/e2e-output-language-batch?chrome=0')

  const outputLanguage = page.getByRole('combobox', { name: 'Explanation language' })
  await expect(outputLanguage).toHaveValue('vi')

  await outputLanguage.selectOption('ja')
  await page.getByRole('textbox', { name: 'Prompt 1' }).fill('Explain closures')
  await page.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit())

  await expect.poll(async () => page.evaluate(() => {
    const raw = localStorage.getItem('ankiflow_pending_batch')
    if (!raw) return null
    const pending = JSON.parse(raw) as {
      outputLanguage?: string
      items?: Array<{ generated_output_language?: string }>
    }
    return {
      outputLanguage: pending.outputLanguage,
      itemCount: pending.items?.length,
      generatedOutputLanguage: pending.items?.[0]?.generated_output_language,
    }
  })).toEqual({
    outputLanguage: 'ja',
    itemCount: 1,
    generatedOutputLanguage: 'ja',
  })
  await expect(outputLanguage).toHaveValue('vi')
})
