import { useEffect, useState } from 'react'

import business from './business.json'
import { readableOn } from './lib/format'
import AdminView from './views/AdminView'
import ClientView from './views/ClientView'

export default function App() {
  // Админка живёт по адресу /#admin — клиентам переключатель режимов не показываем
  const [isAdmin, setIsAdmin] = useState(() => window.location.hash === '#admin')

  useEffect(() => {
    const onHash = () => {
      setIsAdmin(window.location.hash === '#admin')
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // White-label: акцентный цвет и название берём из business.json
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--theme-color', business.themeColor)
    root.setProperty('--theme-color-contrast', readableOn(business.themeColor))
    document.title = business.name
  }, [])

  return isAdmin ? <AdminView /> : <ClientView />
}
