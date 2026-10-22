import { useCallback, useEffect, useState } from 'react'

import { loadSettings, saveSettings, type SettingsPatch, type ShopSettings } from '../../lib/settings'
import { resolveServices } from '../../lib/slots'

/**
 * Настройки владельца для админки: загрузка + сохранение с оптимистичным обновлением.
 * При ошибке записи значения откатываются и возвращается текст ошибки.
 */
export function useAdminSettings() {
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const s = await loadSettings()
    setSettings(s)
    setLoadError(s === null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const update = useCallback(
    async (patch: SettingsPatch): Promise<string | null> => {
      const prev = settings
      if (!prev) return 'Настройки не загружены.'
      setSettings({
        ...prev,
        boxActive: { ...prev.boxActive, ...patch.boxActive },
        ...(patch.discountEnabled !== undefined ? { discountEnabled: patch.discountEnabled } : {}),
        ...(patch.discountPercent !== undefined ? { discountPercent: patch.discountPercent } : {}),
        ...(patch.servicesConfig !== undefined
          ? {
              servicesConfig: patch.servicesConfig,
              services: resolveServices(patch.servicesConfig),
              allServices: resolveServices(patch.servicesConfig, true),
            }
          : {}),
      })
      const err = await saveSettings(patch)
      if (err) setSettings(prev)
      return err
    },
    [settings]
  )

  return { settings, loading, loadError, reload: load, update }
}

export const SETTINGS_HINT =
  'Не удалось загрузить настройки. Проверьте, что в Supabase выполнен vladislav_settings.sql.'
