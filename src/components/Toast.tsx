import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

type ToastItem = {
  id: number
  kind: ToastKind
  message: string
}

let listeners: Array<(item: ToastItem) => void> = []
let nextId = 1

/** 全局 Toast 提示：成功 / 错误 / 普通信息，自动消失。 */
export function toast(message: string, kind: ToastKind = 'info') {
  const item: ToastItem = { id: nextId++, kind, message }
  for (const listener of listeners) {
    listener(item)
  }
}

const TOAST_ICONS: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info
}

export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const listener = (item: ToastItem) => {
      setToasts((previous) => [...previous.slice(-2), item])
      window.setTimeout(() => {
        setToasts((previous) => previous.filter((toastItem) => toastItem.id !== item.id))
      }, 2200)
    }
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((existing) => existing !== listener)
    }
  }, [])

  return (
    <div className="toast-host" aria-live="polite" aria-atomic="false">
      {toasts.map((item) => {
        const Icon = TOAST_ICONS[item.kind]
        return (
          <div key={item.id} className={`toast toast-${item.kind}`} role="status">
            <Icon size={16} aria-hidden="true" />
            <span>{item.message}</span>
          </div>
        )
      })}
    </div>
  )
}
