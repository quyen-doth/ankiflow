import { NextRequest, NextResponse } from 'next/server'
import { pushMessage } from '@/lib/line/client'

interface StepResult {
  step: string
  success: boolean
  error?: string
  data?: Record<string, unknown>
}

export async function POST() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const userId = process.env.LINE_USER_ID

  if (!token || !userId) {
    return NextResponse.json({
      error: 'LINE credentials not configured',
      token_set: !!token,
      user_id_set: !!userId,
      token_length: token?.length ?? 0,
      user_id_value: userId ?? null,
    }, { status: 500 })
  }

  const results: StepResult[] = []

  // Step 0: Verify token by calling bot info endpoint
  let botInfo: Record<string, unknown> | null = null
  try {
    const botRes = await fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const botBody = await botRes.json().catch(() => ({}))
    if (botRes.ok) {
      botInfo = botBody
      results.push({
        step: 'verify_token',
        success: true,
        data: { bot_name: botBody.displayName, bot_id: botBody.userId },
      })
    } else {
      results.push({
        step: 'verify_token',
        success: false,
        error: `HTTP ${botRes.status}: ${botBody.message ?? 'Unknown'}`,
      })
      return NextResponse.json({
        results,
        diagnosis: 'LINE_CHANNEL_ACCESS_TOKEN is invalid or expired. Re-issue it from LINE Developer Console → Messaging API → Channel access token.',
        token_length: token.length,
      }, { status: 502 })
    }
  } catch (err) {
    results.push({
      step: 'verify_token',
      success: false,
      error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    })
    return NextResponse.json({ results, diagnosis: 'Cannot reach LINE API.' }, { status: 502 })
  }

  // Step 1: Verify user ID by fetching profile
  try {
    const profileRes = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const profileBody = await profileRes.json().catch(() => ({}))
    if (profileRes.ok) {
      results.push({
        step: 'verify_user_id',
        success: true,
        data: { display_name: profileBody.displayName, user_id: userId },
      })
    } else {
      results.push({
        step: 'verify_user_id',
        success: false,
        error: `HTTP ${profileRes.status}: ${profileBody.message ?? 'Unknown'}`,
        data: { user_id_used: userId },
      })
      return NextResponse.json({
        results,
        user_id_used: userId,
        diagnosis: `LINE_USER_ID "${userId}" is invalid or this user has not added the bot as a friend. The correct user ID can be found in: LINE Developer Console → channel Basic Settings → "Your user ID" (bottom of page).`,
      }, { status: 502 })
    }
  } catch (err) {
    results.push({
      step: 'verify_user_id',
      success: false,
      error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    })
  }

  // Step 2: Send simple text message
  const textResult = await pushMessage(token, userId, [{
    type: 'text' as const,
    text: 'AnkiFlow debug: credential test OK',
  }])
  results.push({ step: 'text_message', success: textResult.success, error: textResult.error })

  if (!textResult.success) {
    return NextResponse.json({
      results,
      diagnosis: 'Token and user ID verified but push failed. The user may have blocked the bot.',
    }, { status: 502 })
  }

  const minimalFlex = await pushMessage(token, userId, [{
    type: 'flex' as const,
    altText: 'debug step 2',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [{ type: 'text', text: 'AnkiFlow debug step 2: minimal flex OK' }],
      },
    },
  }])
  results.push({ step: 'minimal_flex', success: minimalFlex.success, error: minimalFlex.error })

  if (!minimalFlex.success) {
    return NextResponse.json({
      results,
      diagnosis: 'Basic Flex Message rejected. This should not happen — possible API version issue.',
    }, { status: 502 })
  }

  const flexWithButtons = await pushMessage(token, userId, [{
    type: 'flex' as const,
    altText: 'debug step 3',
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: 'Test Word', weight: 'bold', size: 'xl', color: '#1e293b' },
        ],
        paddingBottom: 'sm',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'Test meaning', size: 'sm', color: '#334155', wrap: true },
        ],
        paddingTop: 'none',
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'button',
            action: { type: 'postback', label: 'Again 1m', data: 'ankiflow:test=true', displayText: 'Again' },
            style: 'link',
            height: 'sm',
            color: '#dc2626',
          },
          {
            type: 'button',
            action: { type: 'postback', label: 'Good 1d', data: 'ankiflow:test=true', displayText: 'Good' },
            style: 'link',
            height: 'sm',
            color: '#16a34a',
          },
        ],
        spacing: 'none',
      },
    },
  }])
  results.push({ step: 'flex_with_buttons', success: flexWithButtons.success, error: flexWithButtons.error })

  if (!flexWithButtons.success) {
    return NextResponse.json({
      results,
      diagnosis: 'Flex Message with buttons rejected. Issue is in bubble structure or button properties.',
    }, { status: 502 })
  }

  const carousel = await pushMessage(token, userId, [{
    type: 'flex' as const,
    altText: '🧠 test1 · test2',
    contents: {
      type: 'carousel',
      contents: [
        {
          type: 'bubble',
          size: 'kilo',
          body: {
            type: 'box', layout: 'vertical',
            contents: [{ type: 'text', text: 'Carousel bubble 1' }],
          },
        },
        {
          type: 'bubble',
          size: 'kilo',
          body: {
            type: 'box', layout: 'vertical',
            contents: [{ type: 'text', text: 'Carousel bubble 2' }],
          },
        },
      ],
    },
  }])
  results.push({ step: 'carousel', success: carousel.success, error: carousel.error })

  return NextResponse.json({
    results,
    diagnosis: results.every(r => r.success)
      ? 'All steps passed. LINE integration is working correctly.'
      : `Failed at step: ${results.find(r => !r.success)?.step}`,
  })
}

export async function GET(request: NextRequest) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'LINE_CHANNEL_ACCESS_TOKEN not set' }, { status: 500 })
  }

  const action = request.nextUrl.searchParams.get('action') ?? 'followers'

  if (action === 'followers') {
    try {
      const res = await fetch('https://api.line.me/v2/bot/followers/ids', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        return NextResponse.json({
          error: `HTTP ${res.status}: ${body.message ?? 'Unknown'}`,
          hint: 'This API requires the channel to have "Obtain user IDs" permission enabled in LINE Developer Console.',
        }, { status: res.status })
      }

      const userIds: string[] = body.userIds ?? []
      const profiles = await Promise.all(
        userIds.slice(0, 10).map(async (uid: string) => {
          const pRes = await fetch(`https://api.line.me/v2/bot/profile/${uid}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const pBody = await pRes.json().catch(() => ({}))
          return {
            userId: uid,
            displayName: pBody.displayName ?? 'Unknown',
            pictureUrl: pBody.pictureUrl ?? null,
          }
        })
      )

      return NextResponse.json({
        total_followers: userIds.length,
        followers: profiles,
        instruction: 'Copy the userId of your account and set it as LINE_USER_ID in .env',
      })
    } catch (err) {
      return NextResponse.json({
        error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
