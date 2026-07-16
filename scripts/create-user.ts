/**
 * Create an internal AnkiFlow account while public signup remains disabled.
 *
 * Usage:
 *   npm run user:create -- user@example.com
 */

import * as dotenv from 'dotenv'
import { createInterface } from 'node:readline/promises'
import { pathToFileURL } from 'node:url'
import { provisionUserAccount } from '../lib/account-provisioning'
import { emailSchema, passwordSchema } from '../lib/auth-validation'

function printUsage(): void {
  console.log('Usage: npm run user:create -- <email>')
  console.log('The password is requested securely and is never accepted as a command argument.')
}

function assertFirebaseAdminConfig(): void {
  const requiredNames = [
    'FIREBASE_ADMIN_PROJECT_ID',
    'FIREBASE_ADMIN_CLIENT_EMAIL',
    'FIREBASE_ADMIN_PRIVATE_KEY',
  ] as const
  const missingNames = requiredNames.filter((name) => !process.env[name]?.trim())
  if (missingNames.length > 0) {
    throw new Error(`Missing required environment variables: ${missingNames.join(', ')}`)
  }
}

export function parseCreateUserEmail(args: string[]): string | null {
  if (args.length !== 1 || args[0].startsWith('--')) return null
  const parsed = emailSchema.safeParse(args[0].trim())
  return parsed.success ? parsed.data : null
}

function promptHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
    return Promise.reject(new Error('A TTY is required to enter the password securely.'))
  }

  return new Promise((resolve, reject) => {
    let value = ''
    process.stdout.write(question)
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    const cleanup = () => {
      process.stdin.off('data', onData)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdout.write('\n')
    }

    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup()
          reject(new Error('Account creation cancelled.'))
          return
        }
        if (character === '\r' || character === '\n') {
          cleanup()
          resolve(value)
          return
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1)
          continue
        }
        if (character >= ' ') value += character
      }
    }

    process.stdin.on('data', onData)
  })
}

async function confirmCreation(email: string): Promise<boolean> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await prompt.question(`Create and seed account ${email}? [y/N] `)
    return answer.trim().toLowerCase() === 'y'
  } finally {
    prompt.close()
  }
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  if (args.includes('--help')) {
    printUsage()
    return
  }

  const email = parseCreateUserEmail(args)
  if (!email) {
    printUsage()
    throw new Error('Provide exactly one valid email address.')
  }
  dotenv.config({ path: '.env', quiet: true })
  assertFirebaseAdminConfig()

  const password = await promptHidden('Password: ')
  const passwordCheck = passwordSchema.safeParse(password)
  if (!passwordCheck.success) throw new Error(passwordCheck.error.issues[0].message)

  const confirmation = await promptHidden('Confirm password: ')
  if (password !== confirmation) throw new Error('Passwords do not match.')
  if (!(await confirmCreation(email))) {
    console.log('Account creation cancelled; no Firebase writes were performed.')
    return
  }

  const result = await provisionUserAccount({ email, password })
  console.log(`Account created: ${email} (${result.uid})`)

  for (const warning of result.warnings) {
    if (warning.step === 'admin-claim') {
      console.error('Admin claim failed. Recovery: npx tsx scripts/set-admin-claim.ts ' + email)
    } else {
      console.error('Default data seed failed. Recovery: npm run seed -- --user ' + result.uid)
    }
  }

  if (result.warnings.length > 0) process.exitCode = 1
}

const executedFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : null
if (executedFile === import.meta.url) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Create user failed: ${message}`)
    process.exitCode = 1
  })
}
