/**
 * Temporary script to capture LINE user ID from webhook events.
 *
 * Steps:
 * 1. Run: npx tsx scripts/capture-line-userid.ts
 * 2. In another terminal: ngrok http 3001
 * 3. Copy the ngrok HTTPS URL (e.g. https://xxxx.ngrok-free.app)
 * 4. LINE Developer Console → Channel → Messaging API → Webhook URL
 *    → paste: https://xxxx.ngrok-free.app/webhook
 *    → click "Update" → click "Verify" (should say "Success")
 * 5. Send any message from your personal LINE to the bot
 * 6. This script will print your user ID
 * 7. Copy that user ID → set as LINE_USER_ID in .env
 * 8. Restore the original webhook URL in LINE Developer Console
 */

import { createServer } from 'http'

const PORT = 3001

const server = createServer((req, res) => {
  if (req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        const events = data.events ?? []

        if (events.length === 0) {
          console.log('\n📡 Webhook verification request received (no events) — OK')
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('{}')
          return
        }

        for (const event of events) {
          const userId = event.source?.userId
          const type = event.type
          const displayName = event.source?.type

          console.log('\n' + '='.repeat(60))
          console.log('📨 Webhook event received!')
          console.log(`   Type: ${type}`)
          console.log(`   Source type: ${displayName}`)
          console.log('')
          console.log(`   ✅ YOUR LINE USER ID: ${userId}`)
          console.log('')
          console.log(`   → Copy this and set LINE_USER_ID=${userId} in .env`)
          console.log('='.repeat(60))
        }
      } catch (err) {
        console.error('Parse error:', err)
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('{}')
    })
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('LINE User ID Capture Server — send POST to /webhook')
  }
})

server.listen(PORT, () => {
  console.log(`\n🔧 LINE User ID Capture Server`)
  console.log(`   Listening on http://localhost:${PORT}`)
  console.log('')
  console.log('Next steps:')
  console.log(`  1. Run ngrok:  ngrok http ${PORT}`)
  console.log('  2. Copy the HTTPS URL from ngrok')
  console.log('  3. LINE Developer Console → Messaging API → Webhook URL')
  console.log('     → paste: https://xxxx.ngrok-free.app/webhook')
  console.log('  4. Send a message from your personal LINE to the bot')
  console.log('  5. Your user ID will appear here')
  console.log('')
  console.log('Waiting for webhook events...\n')
})
