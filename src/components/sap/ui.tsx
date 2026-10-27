'use client'
import React, { useEffect, useState } from 'react'
import s from './sap.module.css'
import { lookup, udfMeta, apiGet, type Opt, type UdfMeta, type WriteResult } from './sapApi'

export function Field({ label, req, children, wide }: { label: string; req?: boolean; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`${s.field} ${wide ? s.fieldWide : ''}`}>
      <span className={req ? s.labelReq : s.label} title={label}>{label}</span>
      <div>{children}</div>
    </div>
  )
}

export function TextInput(p: { value: any; onChange?: (v: string) => void; readOnly?: boolean; type?: string; id?: string; placeholder?: string; className?: string }) {
  return (
    <input
      id={p.id}
      className={`${s.input} ${p.className || ''}`}
      type={p.type || 'text'}
      value={p.value ?? ''}
      readOnly={p.readOnly || !p.onChange}
      placeholder={p.placeholder}
      onChange={e => p.onChange?.(e.target.value)}
    />
  )
}

export function useLookup(name: string | null, params = '') {
  const [opts, setOpts] = useState<Opt[]>([])
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    if (!name) return
    let alive = true
    lookup(name, params).then(o => alive && setOpts(o)).catch(e => alive && setErr(e.message))
    return () => { alive = false }
  }, [name, params])
  return { opts, err }
}

export function LookupSelect(p: {
  name: string; params?: string; value: any; onChange?: (v: any, opt?: Opt) => void; numeric?: boolean; allowEmpty?: boolean; disabled?: boolean; id?: string
}) {
  const { opts, err } = useLookup(p.name, p.params || '')
  const has = opts.some(o => String(o.value) === String(p.value ?? ''))
  return (
    <select
      id={p.id}
      className={s.select}
      value={p.value ?? ''}
      disabled={p.disabled || !p.onChange}
      title={err || undefined}
      onChange={e => {
        const raw = e.target.value
        const opt = opts.find(o => String(o.value) === raw)
        p.onChange?.(raw === '' ? null : p.numeric ? Number(raw) : raw, opt)
      }}
    >
      {(p.allowEmpty !== false) && <option value="">{err ? '(error al cargar)' : ''}</option>}
      {!has && p.value != null && p.value !== '' && <option value={p.value}>{String(p.value)}</option>}
      {opts.map(o => (
        <option key={String(o.value)} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

/** Panel de campos definidos por usuario (como el panel derecho de SAP) */
export function UdfPanel({ table, fields, values, onChange, title, inline }: {
  table: string; fields: string[]; values: Record<string, any>; onChange?: (name: string, v: any) => void; title?: string; inline?: boolean
}) {
  const [meta, setMeta] = useState<UdfMeta[]>([])
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    udfMeta(table, fields).then(setMeta).catch(e => setErr(e.message))
  }, [table, fields.join(',')])
  const body = (
    <div className={s.col}>
      {err && <div className={s.err}>{err}</div>}
      {meta.map(m => (
        <Field key={m.name} label={m.label} req={m.mandatory}>
          <UdfInput meta={m} value={values[m.name]} onChange={onChange ? v => onChange(m.name, v) : undefined} />
        </Field>
      ))}
    </div>
  )
  if (inline) return body
  return (
    <aside className={s.udfPanel}>
      <div className={s.udfTitle}>{title || 'Campos definidos por usuario'}</div>
      {body}
    </aside>
  )
}

function UdfInput({ meta, value, onChange }: { meta: UdfMeta; value: any; onChange?: (v: any) => void }) {
  if (meta.validValues.length) {
    return (
      <select className={s.select} value={value ?? ''} disabled={!onChange} onChange={e => onChange?.(e.target.value || null)}>
        <option value=""></option>
        {value && !meta.validValues.some(v => v.value === value) && <option value={value}>{value}</option>}
        {meta.validValues.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
      </select>
    )
  }
  if (meta.linkedTable) {
    return <LookupSelect name="udt" params={`table=${meta.linkedTable}`} value={value} onChange={onChange ? v => onChange(v) : undefined} />
  }
  if (meta.type === 'db_Float' || meta.type === 'db_Numeric') {
    return <TextInput type="number" value={value ?? ''} onChange={onChange ? v => onChange(v === '' ? null : Number(v)) : undefined} />
  }
  if (meta.type === 'db_Date') {
    return <TextInput type="date" value={value ? String(value).slice(0, 10) : ''} onChange={onChange ? v => onChange(v || null) : undefined} />
  }
  return <TextInput value={value ?? ''} onChange={onChange ? v => onChange(v || null) : undefined} />
}

export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className={s.tabs}>
      {tabs.map(t => (
        <button key={t} type="button" className={`${s.tab} ${t === active ? s.tabActive : ''}`} onClick={() => onChange(t)}>{t}</button>
      ))}
    </div>
  )
}

export function Window({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className={s.window}>
      <div className={s.titleBar}>
        <span>{title} {subtitle && <small>— {subtitle}</small>}</span>
        <span className={s.muted}>_ ▢ ✕</span>
      </div>
      {children}
    </div>
  )
}

/** Diálogo de confirmación antes de escribir en SAP */
export function ConfirmDialog({ open, title, description, dryRun, danger, onCancel, onConfirm }: {
  open: boolean; title: string; description: React.ReactNode; dryRun: boolean; danger?: boolean; onCancel: () => void; onConfirm: () => void
}) {
  if (!open) return null
  return (
    <div className={s.overlay} role="dialog" aria-modal="true" id="sap-confirm-dialog">
      <div className={s.dialog}>
        <div className={s.titleBar}><span>{title}</span></div>
        <div className={s.dialogBody}>
          {dryRun ? (
            <div className={s.warnBox}>Modo simulación activo: no se enviará nada a SAP. Se mostrará el payload que se enviaría al Service Layer.</div>
          ) : (
            <div className={s.dangerBox}>Atención: esta operación se ejecutará de forma REAL en SAP Business One (producción). No se puede deshacer desde el portal.</div>
          )}
          <div>{description}</div>
        </div>
        <div className={s.actions}>
          <button type="button" className={danger && !dryRun ? s.btnDanger : s.btnOk} onClick={onConfirm} id="sap-confirm-yes">
            {dryRun ? 'Simular' : 'Sí, ejecutar en SAP'}
          </button>
          <button type="button" className={s.btn} onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

/** Resultado de una escritura (o del dry-run con el payload) */
export function ResultDialog({ result, onClose }: { result: WriteResult | null; onClose: () => void }) {
  if (!result) return null
  return (
    <div className={s.overlay} role="dialog" id="sap-result-dialog">
      <div className={s.dialog}>
        <div className={s.titleBar}><span>{result.ok ? (result.dryRun ? 'Simulación (dry-run)' : 'Operación completada en SAP') : 'Error de SAP'}</span></div>
        <div className={s.dialogBody}>
          {!result.ok && <div className={s.err}>{result.error}</div>}
          {result.dryRun && result.request && (
            <>
              <div className={s.warnBox}>
                No se envió nada a SAP. Petición que se enviaría: <b>{result.request.method}</b> <code>/b1s/v1/{result.request.endpoint}</code> ({result.request.companyDB})
              </div>
              <pre className={s.pre} id="sap-dryrun-payload">{JSON.stringify(result.request.body, null, 2)}</pre>
            </>
          )}
          {result.ok && !result.dryRun && (
            <div className={s.ok}>
              SAP aceptó la operación.
              {result.data?.DocNum ? ` Documento Nº ${result.data.DocNum} (DocEntry ${result.data.DocEntry}).` : ''}
              {result.data?.CardCode ? ` Código ${result.data.CardCode}.` : ''}
            </div>
          )}
        </div>
        <div className={s.actions}><button type="button" className={s.btnOk} onClick={onClose}>OK</button></div>
      </div>
    </div>
  )
}

/** Selector de cliente (lista de selección de socios de negocio) */
export function BpPicker({ open, onPick, onClose }: { open: boolean; onPick: (bp: any) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const search = async () => {
    setLoading(true); setErr(null)
    try { setRows((await apiGet(`/api/sap/lookups/bp?q=${encodeURIComponent(q)}`)).rows) } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }
  useEffect(() => { if (open) search() }, [open])
  if (!open) return null
  return (
    <div className={s.overlay}>
      <div className={s.dialog} style={{ minWidth: 640 }}>
        <div className={s.titleBar}><span>Lista de socios de negocio</span></div>
        <div className={s.dialogBody}>
          <div className={s.filters}>
            <label>Buscar <input className={s.input} autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} /></label>
            <button className={s.miniBtn} onClick={search}>Buscar</button>
            {loading && <span className={s.muted}>Consultando SAP…</span>}
          </div>
          {err && <div className={s.err}>{err}</div>}
          <div className={s.gridWrap}>
            <table className={s.grid}>
              <thead><tr><th>Código SN</th><th>Nombre SN</th><th>NIT</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.CardCode} className={s.rowClickable} onDoubleClick={() => onPick(r)} onClick={() => onPick(r)}>
                    <td>{r.CardCode}</td><td>{r.CardName}</td><td>{r.FederalTaxID}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={s.actions}><button className={s.btn} onClick={onClose}>Cancelar</button></div>
      </div>
    </div>
  )
}

/** Selector de artículo */
export function ItemPicker({ open, onPick, onClose }: { open: boolean; onPick: (it: any) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const search = async () => {
    setLoading(true); setErr(null)
    try { setRows((await apiGet(`/api/sap/lookups/items?q=${encodeURIComponent(q)}`)).rows) } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }
  useEffect(() => { if (open) { setRows([]); } }, [open])
  if (!open) return null
  return (
    <div className={s.overlay}>
      <div className={s.dialog} style={{ minWidth: 640 }}>
        <div className={s.titleBar}><span>Lista de artículos</span></div>
        <div className={s.dialogBody}>
          <div className={s.filters}>
            <label>Buscar <input className={s.input} autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} /></label>
            <button className={s.miniBtn} onClick={search}>Buscar</button>
            {loading && <span className={s.muted}>Consultando SAP…</span>}
          </div>
          {err && <div className={s.err}>{err}</div>}
          <div className={s.gridWrap}>
            <table className={s.grid}>
              <thead><tr><th>Número de artículo</th><th>Descripción</th><th className={s.num}>En stock</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.ItemCode} className={s.rowClickable} onClick={() => onPick(r)}>
                    <td>{r.ItemCode}</td><td>{r.ItemName}</td><td className={s.num}>{r.QuantityOnStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={s.actions}><button className={s.btn} onClick={onClose}>Cancelar</button></div>
      </div>
    </div>
  )
}

export function StatusBadge({ row }: { row: any }) {
  if (row.Cancelled === 'tYES') return <span className={`${s.badge} ${s.bCancel}`}>Cancelado</span>
  if (row.DocumentStatus === 'bost_Close') return <span className={`${s.badge} ${s.bClosed}`}>Cerrado</span>
  if (row.DocumentStatus === 'bost_Open') return <span className={`${s.badge} ${s.bOpen}`}>Abierto</span>
  return <span className={`${s.badge} ${s.bOpen}`}>Activo</span>
}
