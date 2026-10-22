import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Не заданы VITE_SUPABASE_URL и/или VITE_SUPABASE_ANON_KEY. Добавьте их в файл .env'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
