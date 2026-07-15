import type { ComponentProps } from 'react'
import { z } from 'zod'
import { LoginForm } from '@/components/auth/LoginForm'
import { registerUnit } from '@/verify/core/registry'

type LoginFormProps = ComponentProps<typeof LoginForm>

registerUnit<LoginFormProps>({
  id: 'LoginForm',
  title: 'LoginForm',
  description: '公開 signup の状態に応じて account creation link を制御する。',
  kind: 'component',
  render: props => <LoginForm {...props} />,
  propsSchema: z.object({ signupEnabled: z.boolean() }),
  fixtures: [
    {
      id: 'signup-enabled',
      description: '公開 signup が有効な場合は作成リンクを表示する。',
      props: { signupEnabled: true },
    },
    {
      id: 'probe-signup-disabled',
      probe: true,
      description: 'Probe: 公開 signup が無効な場合は作成リンクを表示しない。',
      props: { signupEnabled: false },
    },
  ],
  invariants: [
    {
      id: 'signup-link-matches-policy',
      description: 'Create account link の有無が signupEnabled と一致する。',
      check: ({ root, props }) => {
        const link = root.querySelector<HTMLAnchorElement>('a[href="/signup"]')
        return Boolean(link) === props.signupEnabled ||
          `link=${Boolean(link)}, expected=${props.signupEnabled}`
      },
    },
    {
      id: 'login-form-remains-available',
      description: 'Signup が無効でも既存ユーザー向け login form を維持する。',
      check: ({ root }) =>
        Boolean(root.querySelector('form')) || 'login form が見つからない',
    },
  ],
})
