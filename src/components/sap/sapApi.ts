'use client'
// Cliente HTTP del portal hacia /api/sap/* (envía el token de Supabase)
import { getSupabaseClient } from '@/lib/supabase/client'

export type Opt = { value: string | number; label: string; extra?: any }

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await getSupabaseClient().auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(path, { headers: await authHeaders(), cache: 'no-store' })
  const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
  if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}

export interface WriteResult {
  ok: boolean
  dryRun?: boolean
  error?: string
  data?: any
  request?: { method: string; endpoint: string; companyDB: string; headers: Record<string, string>; body: any }
}

export async function apiWrite(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body: any,
  opts: { dryRun: boolean; confirm: string }
): Promise<WriteResult> {
  const headers: Record<string, string> = {
    ...(await authHeaders()),
    'Content-Type': 'application/json',
  }
  if (opts.dryRun) headers['x-dry-run'] = '1'
  else headers['x-sap-confirm'] = opts.confirm
  const res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
  return json
}

const lookupCache = new Map<string, Promise<Opt[]>>()
export function lookup(name: string, params = ''): Promise<Opt[]> {
  const key = `${name}?${params}`
  if (!lookupCache.has(key)) {
    const p = apiGet<{ options: Opt[] }>(`/api/sap/lookups/${name}${params ? `?${params}` : ''}`)
      .then(r => r.options || [])
      .catch(e => {
        lookupCache.delete(key)
        throw e
      })
    lookupCache.set(key, p)
  }
  return lookupCache.get(key)!
}

export interface UdfMeta {
  name: string
  label: string
  type: string
  subType?: string
  linkedTable: string | null
  defaultValue: string | null
  mandatory: boolean
  validValues: { value: string; label: string }[]
}
const udfCache = new Map<string, Promise<UdfMeta[]>>()
export function udfMeta(table: string, fields: string[]): Promise<UdfMeta[]> {
  const key = `${table}:${fields.join(',')}`
  if (!udfCache.has(key)) {
    udfCache.set(
      key,
      apiGet<{ fields: UdfMeta[] }>(`/api/sap/lookups/udf?table=${table}&fields=${encodeURIComponent(fields.join(','))}`)
        .then(r => {
          // Mantener el orden pedido
          return fields.map(f => r.fields.find(x => x.name === f)).filter(Boolean) as UdfMeta[]
        })
        .catch(e => {
          udfCache.delete(key)
          throw e
        })
    )
  }
  return udfCache.get(key)!
}

export const fmtMoney = (n: any) =>
  `$ ${Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const fmtDate = (s: any) => (s ? String(s).slice(0, 10) : '')
export const today = () => {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}
