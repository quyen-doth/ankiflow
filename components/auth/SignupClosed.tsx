import Link from 'next/link'

export function SignupClosed() {
  return (
    <div className="bg-surface border border-border rounded-[14px] p-7 sm:p-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1">Sign-ups are currently closed</h1>
      <p className="text-[13px] text-slate-600 mb-6">
        AnkiFlow is not accepting new accounts yet.
      </p>
      <Link
        href="/login"
        className="block w-full rounded-[9px] border border-border bg-white px-4 py-2.5 text-center text-[13px] font-bold text-primary hover:bg-canvas"
      >
        Back to sign in
      </Link>
    </div>
  )
}
