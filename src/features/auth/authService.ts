import { z } from 'zod'
import { isSupabaseConfigured, createSupabaseClient } from '../../repositories/supabaseClient'
import type { AuthUser } from './authTypes'

export const authSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(8, '密码至少 8 位')
})

export function validateAuthInput(input: unknown) {
  return authSchema.safeParse(input)
}

let currentUser: AuthUser | null = null
const listeners = new Set<() => void>()

export function getCurrentUser(): AuthUser | null {
  return currentUser
}

export function subscribeToAuth(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyAuthChanged() {
  for (const listener of listeners) {
    listener()
  }
}

function toAuthUser(id: string, email: string): AuthUser {
  return { id, email }
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const client = createSupabaseClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })

  if (error) {
    throw error
  }

  if (!data.user) {
    throw new Error('登录失败：未返回用户信息')
  }

  currentUser = toAuthUser(data.user.id, data.user.email ?? email)
  notifyAuthChanged()
  return currentUser
}

export async function signUp(email: string, password: string): Promise<AuthUser | null> {
  const client = createSupabaseClient()
  const { data, error } = await client.auth.signUp({ email, password })

  if (error) {
    throw error
  }

  // 邮件确认开启时 session 为空，用户需要先确认邮件再登录。
  if (!data.session) {
    return null
  }

  if (!data.user) {
    throw new Error('注册失败：未返回用户信息')
  }

  currentUser = toAuthUser(data.user.id, data.user.email ?? email)
  notifyAuthChanged()
  return currentUser
}

export async function requestPasswordReset(email: string): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client.auth.resetPasswordForEmail(email)
  if (error) {
    throw error
  }
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) {
    currentUser = null
    notifyAuthChanged()
    return
  }

  const client = createSupabaseClient()
  const { error } = await client.auth.signOut()
  if (error) {
    throw error
  }
  currentUser = null
  notifyAuthChanged()
}

export async function restoreSession(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured()) {
    currentUser = null
    return null
  }

  const client = createSupabaseClient()
  const { data, error } = await client.auth.getSession()
  if (error) {
    currentUser = null
    return null
  }

  currentUser = data.session?.user ? toAuthUser(data.session.user.id, data.session.user.email ?? '') : null
  notifyAuthChanged()
  return currentUser
}
