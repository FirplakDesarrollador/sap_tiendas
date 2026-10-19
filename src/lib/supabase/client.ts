import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL o clave anónima faltantes en las variables de entorno.')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

let browserClient: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (typeof window === 'undefined') {
    return createClient()
  }

  if (!browserClient) {
    browserClient = createClient()
  }
  return browserClient
}
