import { Cloud, CloudOff, Database, Download, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getCurrentUser, signOut, subscribeToAuth } from '../auth/authService'
import { createLocalDb } from '../../repositories/localDb'
import { isSupabaseConfigured, createSupabaseClient } from '../../repositories/supabaseClient'
import { createSupabaseRepository } from '../../repositories/supabaseRepository'
import {
  flushSyncQueue,
  mergeReviewLogs,
  mergeStudySessions,
  mergeUserWord
} from '../../repositories/syncService'
import type { ReviewLog, StudySession, UserWord } from '../../types/domain'

const LOCAL_USER_ID = 'local'
const LAST_SYNC_KEY = 'kaoyan-last-sync-at'

type SyncNotice = {
  kind: 'success' | 'error'
  message: string
}

export default function SettingsPage() {
  const configured = isSupabaseConfigured()
  const [user, setUser] = useState(() => getCurrentUser())
  const [syncing, setSyncing] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [notice, setNotice] = useState<SyncNotice | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => localStorage.getItem(LAST_SYNC_KEY))

  useEffect(() => subscribeToAuth(() => setUser(getCurrentUser())), [])

  const handleSync = useCallback(async () => {
    if (!configured || !user) {
      setNotice({ kind: 'error', message: '当前为本地模式，无法同步。请先在 /auth 登录。' })
      return
    }

    setSyncing(true)
    setNotice(null)
    const db = createLocalDb()
    try {
      const client = createSupabaseClient()
      const remote = createSupabaseRepository(client)

      // 1. 先上传本地待同步队列
      const flushed = await flushSyncQueue(db, user.id, remote)

      // 2. 拉取云端数据并合并回本地
      const [cloudWords, cloudLogs, cloudSessions] = await Promise.all([
        remote.listUserWords(user.id),
        remote.listReviewLogs(user.id),
        remote.listStudySessions(user.id)
      ])

      const [localWords, localLogs, localSessions] = await Promise.all([
        db.userWords.where('userId').equals(user.id).toArray(),
        db.reviewLogs.where('userId').equals(user.id).toArray(),
        db.studySessions.where('userId').equals(user.id).toArray()
      ])

      const mergedWords = new Map<string, UserWord>()
      for (const word of [...cloudWords, ...localWords]) {
        const existing = mergedWords.get(word.normalizedTerm)
        mergedWords.set(word.normalizedTerm, existing ? mergeUserWord(existing, word) : word)
      }
      for (const word of mergedWords.values()) {
        await db.userWords.put(word)
      }

      const mergedLogs = mergeReviewLogs(localLogs, cloudLogs)
      for (const log of mergedLogs) {
        await db.reviewLogs.put(log)
      }

      const mergedSessions = mergeStudySessions(localSessions, cloudSessions)
      for (const session of mergedSessions) {
        await db.studySessions.put(session)
      }

      const now = Date.now()
      localStorage.setItem(LAST_SYNC_KEY, String(now))
      setLastSyncAt(new Date(now).toLocaleString())
      setNotice({
        kind: 'success',
        message: `同步完成：上传 ${flushed.succeeded} 条${flushed.failed ? `，失败 ${flushed.failed} 条` : ''}，合并云端数据 ${mergedWords.size} 词 / ${mergedLogs.length} 日志 / ${mergedSessions.length} 会话。`
      })
    } catch (error) {
      setNotice({ kind: 'error', message: `同步失败：${error instanceof Error ? error.message : '未知错误'}` })
    } finally {
      db.close()
      setSyncing(false)
    }
  }, [configured, user])

  const handleExport = useCallback(async () => {
    const db = createLocalDb()
    try {
      const words = await db.userWords.toArray()
      const logs = await db.reviewLogs.toArray()
      const sessions = await db.studySessions.toArray()
      const payload = JSON.stringify({ exportedAt: new Date().toISOString(), words, logs, sessions }, null, 2)
      const blob = new Blob([payload], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `研词个人数据-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } finally {
      db.close()
    }
  }, [])

  const handleClearCache = useCallback(async () => {
    if (!window.confirm('确定清理本地学习数据吗？云端数据不受影响，此操作不可撤销。')) {
      return
    }

    setClearing(true)
    const db = createLocalDb()
    try {
      await db.userWords.clear()
      await db.reviewLogs.clear()
      await db.studySessions.clear()
      setNotice({ kind: 'success', message: '本地缓存已清理（保留同步队列和查询缓存）。' })
    } finally {
      db.close()
      setClearing(false)
    }
  }, [])

  return (
    <section className="page settings-page" aria-labelledby="settings-title">
      <div className="page-heading">
        <p className="eyebrow">SETTINGS</p>
        <h1 id="settings-title">设置与同步</h1>
      </div>

      <div className="settings-list">
        <div className="settings-row">
          <div className="settings-row-icon">
            {configured ? <Cloud size={20} aria-hidden="true" /> : <CloudOff size={20} aria-hidden="true" />}
          </div>
          <div className="settings-row-main">
            <h2>当前模式</h2>
            <p>
              {configured
                ? user
                  ? `云同步模式（${user.email}）`
                  : '已配置云同步，尚未登录'
                : '本地模式（数据仅保存在本机浏览器）'}
            </p>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-icon">
            <RefreshCw size={20} aria-hidden="true" />
          </div>
          <div className="settings-row-main">
            <h2>最近同步</h2>
            <p>{lastSyncAt ? lastSyncAt : '尚未同步过'}</p>
            <button
              type="button"
              className="button button-primary"
              onClick={() => void handleSync()}
              disabled={syncing || !configured}
            >
              {syncing ? '同步中…' : '立即同步'}
            </button>
            {!configured ? <p className="settings-hint">配置 Supabase 环境变量后可用（见 docs/deployment.md）。</p> : null}
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-icon">
            <Download size={20} aria-hidden="true" />
          </div>
          <div className="settings-row-main">
            <h2>数据导出</h2>
            <p>导出个人生词、复习日志和学习会话为 JSON 文件。</p>
            <button type="button" className="button button-secondary" onClick={() => void handleExport()}>
              导出个人数据
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-icon">
            <Database size={20} aria-hidden="true" />
          </div>
          <div className="settings-row-main">
            <h2>本地缓存</h2>
            <p>清理本机的生词、日志与会话（保留同步队列和查询缓存）。</p>
            <button
              type="button"
              className="button button-secondary button-danger"
              onClick={() => void handleClearCache()}
              disabled={clearing}
            >
              <Trash2 size={16} aria-hidden="true" />
              清理本地缓存
            </button>
          </div>
        </div>

        {user ? (
          <div className="settings-row">
            <div className="settings-row-icon">
              <CloudOff size={20} aria-hidden="true" />
            </div>
            <div className="settings-row-main">
              <h2>账号</h2>
              <p>{user.email}</p>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  void signOut()
                }}
              >
                退出登录
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {notice ? (
        <p role="status" className={`import-notice import-notice-${notice.kind}`}>
          {notice.message}
        </p>
      ) : null}
    </section>
  )
}
