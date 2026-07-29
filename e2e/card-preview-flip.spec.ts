import { expect, test, type Locator } from '@playwright/test'

async function elementHeight(locator: Locator): Promise<number> {
  return locator.evaluate(element => element.getBoundingClientRect().height)
}

async function waitForIframeReady(iframe: Locator): Promise<void> {
  await expect.poll(
    () => iframe.evaluate(element => (
      (element as HTMLIFrameElement).contentDocument?.readyState ?? ''
    )),
  ).toBe('complete')
}

async function waitForStageToMatchIframe(
  stage: Locator,
  iframe: Locator,
): Promise<void> {
  await expect.poll(async () => {
    const [stageHeight, iframeHeight] = await Promise.all([
      elementHeight(stage),
      elementHeight(iframe),
    ])
    return Math.abs(stageHeight - iframeHeight)
  }).toBeLessThan(3)
}

test('カードをクリックすると独立した裏面へ3D反転し、表面へ戻る', async ({ page }) => {
  await page.goto('/verify/CardPreview/language-entry?chrome=0')

  const preview = page.locator('[data-verify-unit="CardPreview"]')
  const rotator = page.locator('[data-card-preview-rotator]')
  const frontFace = page.locator('[data-card-face="front"]')
  const backFace = page.locator('[data-card-face="back"]')
  const frontIframe = page.locator('iframe[title="Card front preview"]')
  const backIframe = page.locator('iframe[title="Card back preview"]')

  await expect(frontIframe).toHaveCount(1)
  await expect(backIframe).toHaveCount(1)
  await expect(frontFace).toHaveAttribute('aria-hidden', 'false')
  await expect(backFace).toHaveAttribute('aria-hidden', 'true')

  const frontHtml = await frontIframe.getAttribute('srcdoc')
  const backHtml = await backIframe.getAttribute('srcdoc')
  expect(frontHtml).toContain('class="han-viet"')
  expect(backHtml).not.toContain('class="han-viet"')
  expect(backHtml).not.toContain('id="answer"')

  await page.getByRole('button', { name: 'Reveal card answer' }).click()
  await expect(preview).toHaveAttribute('data-verify-flipped', 'true')
  await expect(page.getByRole('button', { name: 'Show card front' })).toHaveAttribute('aria-pressed', 'true')
  await expect(frontFace).toHaveAttribute('aria-hidden', 'true')
  await expect(backFace).toHaveAttribute('aria-hidden', 'false')
  await expect(rotator).toHaveCSS('transform', /matrix3d\(-1/)

  await page.getByRole('button', { name: 'Show card front' }).click()
  await expect(preview).toHaveAttribute('data-verify-flipped', 'false')
  await expect(page.getByRole('button', { name: 'Reveal card answer' })).toHaveAttribute('aria-pressed', 'false')
  await expect(frontFace).toHaveAttribute('aria-hidden', 'false')
  await expect(backFace).toHaveAttribute('aria-hidden', 'true')
})

test('表裏を切り替えると長い裏面へ伸び、短い表面へ縮む', async ({ page }) => {
  await page.goto('/verify/CardPreview/height-dynamics?chrome=0')

  const stage = page.locator('[data-card-preview-stage]')
  const preview = page.locator('[data-verify-unit="CardPreview"]')
  const frontIframe = page.locator('iframe[title="Card front preview"]')
  const backIframe = page.locator('iframe[title="Card back preview"]')
  await waitForIframeReady(frontIframe)
  await waitForIframeReady(backIframe)
  await waitForStageToMatchIframe(stage, frontIframe)
  const frontHeight = await elementHeight(stage)

  await page.getByRole('button', { name: 'Reveal card answer' }).click()
  await expect(preview).toHaveAttribute('data-verify-flipped', 'true')
  await waitForStageToMatchIframe(stage, backIframe)
  const backHeight = await elementHeight(stage)
  expect(backHeight).toBeGreaterThan(frontHeight + 80)

  await page.getByRole('button', { name: 'Show card front' }).click()
  await expect(preview).toHaveAttribute('data-verify-flipped', 'false')
  await waitForStageToMatchIframe(stage, frontIframe)
  const restoredHeight = await elementHeight(stage)
  expect(Math.abs(restoredHeight - frontHeight)).toBeLessThan(3)
})

test('card type を変更すると表面へ戻り、新しい内容の高さへ更新する', async ({ page }) => {
  await page.goto('/verify/CardPreview/height-dynamics?chrome=0')

  const stage = page.locator('[data-card-preview-stage]')
  const preview = page.locator('[data-verify-unit="CardPreview"]')
  const frontIframe = page.locator('iframe[title="Card front preview"]')
  await waitForIframeReady(frontIframe)
  await waitForStageToMatchIframe(stage, frontIframe)
  const shortHeight = await elementHeight(stage)

  await page.getByRole('button', { name: 'Reveal card answer' }).click()
  await expect(preview).toHaveAttribute('data-verify-flipped', 'true')
  await page.getByRole('button', { name: 'Detailed card' }).click()
  await expect(preview).toHaveAttribute('data-verify-tab', 'ct_detailed')
  await expect(preview).toHaveAttribute('data-verify-flipped', 'false')
  await waitForIframeReady(frontIframe)
  await waitForStageToMatchIframe(stage, frontIframe)
  const detailedHeight = await elementHeight(stage)
  expect(detailedHeight).toBeGreaterThan(shortHeight + 80)

  await page.getByRole('button', { name: 'Short card' }).click()
  await expect(preview).toHaveAttribute('data-verify-tab', 'ct_short')
  await expect(preview).toHaveAttribute('data-verify-flipped', 'false')
  await waitForIframeReady(frontIframe)
  await waitForStageToMatchIframe(stage, frontIframe)
  const restoredHeight = await elementHeight(stage)
  expect(Math.abs(restoredHeight - shortHeight)).toBeLessThan(3)
})

test('読み込み後に画像サイズが変わっても表示中の面を再計測する', async ({ page }) => {
  await page.route('https://preview.test/large-image.svg', async route => {
    await new Promise(resolve => setTimeout(resolve, 150))
    await route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="500" viewBox="0 0 600 500"><rect width="600" height="500" fill="#316342"/></svg>',
    })
  })
  await page.goto('/verify/CardPreview/late-image?chrome=0')

  const stage = page.locator('[data-card-preview-stage]')
  const backIframe = page.locator('iframe[title="Card back preview"]')
  await waitForIframeReady(backIframe)
  await page.getByRole('button', { name: 'Reveal card answer' }).click()
  await waitForStageToMatchIframe(stage, backIframe)
  const initialHeight = await elementHeight(stage)

  const image = page
    .frameLocator('iframe[title="Card back preview"]')
    .locator('img')
  await expect(image).toHaveCount(1)
  await image.evaluate(element => {
    (element as HTMLImageElement).src = 'https://preview.test/large-image.svg'
  })
  await expect.poll(
    () => image.evaluate(element => (element as HTMLImageElement).naturalHeight),
  ).toBe(500)
  await expect.poll(() => elementHeight(stage)).toBeGreaterThan(initialHeight + 80)
  await waitForStageToMatchIframe(stage, backIframe)
})

test('reduced motion 設定ではアニメーションなしで反転状態を適用する', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/verify/CardPreview/height-dynamics?chrome=0')

  const stage = page.locator('[data-card-preview-stage]')
  const rotator = page.locator('[data-card-preview-rotator]')
  await expect(stage).toHaveAttribute('data-reduced-motion', 'true')

  await page.getByRole('button', { name: 'Reveal card answer' }).click()
  await expect(rotator).toHaveCSS('transform', /matrix3d\(-1/)
  const runningAnimations = await rotator.evaluate(element => (
    element.getAnimations().filter(animation => animation.playState === 'running').length
  ))
  expect(runningAnimations).toBe(0)
})
