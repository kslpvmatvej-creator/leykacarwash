import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ChevronLeft, ClipboardList, ImageIcon, Loader2, Lock, LogOut, Mail, Percent, RefreshCw, Tags, ShieldCheck, ToggleRight, TriangleAlert } from 'lucide-react'

import config from '../business.json'
import { supabase } from '../supabaseClient'
import BoxesTab from './admin/BoxesTab'
import LeadsTab from './admin/LeadsTab'
import MediaTab from './admin/MediaTab'
import MarketingTab from './admin/MarketingTab'
import PriceTab from './admin/PriceTab'

type Tab = 'leads' | 'boxes' | 'prices' | 'marketing' | 'media'

const TABS: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
  { id: 'leads', label: 'Заявки', icon: ClipboardList },
  { id: 'boxes', label: 'Управление боксами', icon: ToggleRight },
  { id: 'prices', label: 'Услуги и цены', icon: Tags },
  { id: 'marketing', label: 'Маркетинг', icon: Percent },
  { id: 'media', label: 'Фото сайта', icon: ImageIcon },
]

function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Обычный вход: signInWithPassword. Успех → onAuthStateChange в AdminView сам откроет админку
  const login = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password || loading) return
    setLoading(true)
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (authError) setError('Неверный email или пароль')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
          <ShieldCheck className="h-10 w-10 text-brand-fg" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-50">Кабинет владельца</h1>
        <p className="mt-1 text-sm text-zinc-400">{config.name}</p>
      </div>
      <form onSubmit={login} className="space-y-3">
        <label className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4 focus-within:ring-2 focus-within:ring-brand">
          <Mail className="h-5 w-5 text-brand-fg" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            aria-label="Email"
            className="w-full bg-transparent outline-none placeholder:text-zinc-500"
          />
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4 focus-within:ring-2 focus-within:ring-brand">
          <Lock className="h-5 w-5 text-brand-fg" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            autoComplete="current-password"
            aria-label="Пароль"
            className="w-full bg-transparent outline-none placeholder:text-zinc-500"
          />
        </label>
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
            <TriangleAlert className="h-4 w-4" /> {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!email || !password || loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-4 font-semibold text-brand-contrast transition active:scale-[0.98] disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Войти'}
        </button>
      </form>
    </main>
  )
}

function AdminPanel({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>('leads')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-12 md:max-w-6xl">
      <header className="relative overflow-hidden border-b border-zinc-900 bg-zinc-950 px-6 pb-7 pt-16 text-white">
        <p className="text-xs text-zinc-500">Кабинет владельца</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{config.name}</h1>
        <p className="mt-1 truncate text-sm text-zinc-400">{session.user.email}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href="#"
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium transition active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" /> К записи
          </a>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium transition active:scale-95"
          >
            <RefreshCw className="h-4 w-4" /> Обновить
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium transition active:scale-95"
          >
            <LogOut className="h-4 w-4" /> Выйти
          </button>
        </div>
      </header>

      <nav aria-label="Разделы кабинета" className="sticky top-0 z-10 border-b border-zinc-900 bg-black/90 backdrop-blur">
        <div role="tablist" className="flex gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] md:px-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${
                tab === id ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="px-4 pt-5 md:px-6">
        {tab === 'leads' && <LeadsTab refreshKey={refreshKey} />}
        {tab === 'boxes' && <BoxesTab key={refreshKey} />}
        {tab === 'prices' && <PriceTab key={refreshKey} />}
        {tab === 'marketing' && <MarketingTab key={refreshKey} />}
        {tab === 'media' && <MediaTab key={refreshKey} />}
      </div>
    </div>
  )
}

export default function AdminView() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-fg" />
      </div>
    )
  }
  return session ? <AdminPanel session={session} /> : <AdminLogin />
}

