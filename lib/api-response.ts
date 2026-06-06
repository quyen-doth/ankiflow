import { NextResponse } from 'next/server'

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

export function catchError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : 'Internal server error'
  return apiError(message, status)
}
