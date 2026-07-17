import { expect, test } from '@playwright/test'

test.describe('Content Types admin API security', () => {
  test('session cookie がない mutation は middleware で 401', async ({ request }) => {
    const response = await request.delete('/api/admin/content-types?id=custom_medical')

    expect(response.status()).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  test('偽造 session cookie は route verification で 401', async ({ request }) => {
    const response = await request.put('/api/admin/content-types', {
      headers: {
        cookie: '__session=forged-session-cookie',
        'Content-Type': 'application/json',
      },
      data: {
        id: 'form_language',
        fields: [{ field_key: 'word', label: 'Word' }],
      },
    })

    expect(response.status()).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })
})
