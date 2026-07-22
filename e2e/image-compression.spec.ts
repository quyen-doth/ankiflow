import { expect, test } from '@playwright/test'

test('透過 PNG は縮小後も PNG と alpha channel を保持する', async ({ page }) => {
  await page.goto('/verify/ImageSelector/e2e-upload-transparent-png?chrome=0')

  const sourceDataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2000
    canvas.height = 1000
    const context = canvas.getContext('2d')
    if (!context) throw new Error('2D canvas context is unavailable')
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = 'rgb(220, 38, 38)'
    context.fillRect(800, 300, 400, 400)
    return canvas.toDataURL('image/png')
  })
  const source = Buffer.from(sourceDataUrl.split(',')[1], 'base64')
  // IEND 後の trailing bytes は decoder が無視する。元 file を確実に大きくして圧縮結果を採用させる。
  const oversizedSource = Buffer.concat([source, Buffer.alloc(600 * 1024)])

  await page.getByLabel('Upload image').setInputFiles({
    name: 'transparent.png',
    mimeType: 'image/png',
    buffer: oversizedSource,
  })

  const preview = page.getByAltText('Selected illustration')
  await expect(preview).toBeVisible()
  await expect(preview).toHaveAttribute('src', /^data:image\/png;base64,/)

  const result = await preview.evaluate(async element => {
    const image = element as HTMLImageElement
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('2D canvas context is unavailable')
    context.drawImage(image, 0, 0)
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      transparentAlpha: context.getImageData(0, 0, 1, 1).data[3],
      opaqueAlpha: context.getImageData(800, 400, 1, 1).data[3],
    }
  })

  expect(result).toEqual({
    width: 1600,
    height: 800,
    transparentAlpha: 0,
    opaqueAlpha: 255,
  })
})
