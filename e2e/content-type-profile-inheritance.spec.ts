import { expect, test } from '@playwright/test'

test('言語 profile は Default field を継承し、Exclude/Restore で切り替えられる', async ({ page }) => {
  await page.goto('/verify/AiOutputProfilesEditor/e2e-editor-flow?chrome=0')

  const profileSelect = page.getByRole('combobox', { name: 'AI output profile' })
  await profileSelect.selectOption({ label: 'Chinese' })

  // legacy builtin zh は normalize 済みで ipa だけを exclude している。
  const inherited = page.getByText('Inherited from Default')
  await expect(inherited).toBeVisible()
  const restoreIpa = page.getByRole('button', { name: 'Restore inherited output ipa' })
  await expect(restoreIpa).toBeVisible()

  await restoreIpa.click()
  await expect(page.getByRole('button', { name: 'Exclude inherited output ipa' })).toBeVisible()
})

test('新規 profile は Default field をコピーせず継承だけする', async ({ page }) => {
  await page.goto('/verify/AiOutputProfilesEditor/e2e-editor-flow?chrome=0')

  await page.getByRole('button', { name: 'Add Profile' }).click()

  // own field は 0 件、Default field は継承として現れる。
  await expect(page.getByRole('textbox', { name: /^AI output key/ })).toHaveCount(0)
  await expect(page.getByText('Inherited from Default')).toBeVisible()

  // primary は exclude できない (exact 指定: substring 一致だと word_type に当たる)。
  await expect(
    page.getByRole('button', { name: 'Exclude inherited output word', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Exclude inherited output ipa' })).toBeVisible()
})
