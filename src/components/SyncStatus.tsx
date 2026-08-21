import { CloudOff, LogIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser, signOut, subscribeToAuth } from '../features/auth/authService'

export default function SyncStatus() {
  const [user, setUser] = useState(() => getCurrentUser())

  useEffect(() => subscribeToAuth(() => setUser(getCurrentUser())), [])

  if (!user) {
    return (
      <div className="sync-status">
        <CloudOff size={14} aria-hidden="true" />
        <span>本地模式</span>
        <Link to="/auth" className="sync-login-link">
          <LogIn size={13} aria-hidden="true" />
          登录
        </Link>
      </div>
    )
  }

  return (
    <div className="sync-status sync-status-user">
      <span className="sync-user-email" title={user.email}>
        {user.email}
      </span>
      <button
        type="button"
        className="sync-signout-button"
        onClick={() => {
          void signOut()
        }}
      >
        退出
      </button>
    </div>
  )
}
