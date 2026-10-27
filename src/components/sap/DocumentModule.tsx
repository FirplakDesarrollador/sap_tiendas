'use client'
// Documento de marketing genérico (Ofertas de venta, y luego Entregas / Facturas): lista y detalle desde SAP (lectura)
import React, { useCallback, useEffect, useState } from 'react'
import s from './sap.module.css'
import { apiGet, fmtMoney, fmtDate } from './sapApi'
import { Field, TextInput, Tabs, Window, UdfPanel, StatusBadge, useLookup } from './ui'

export interface DocConfig {
  module: 'ofertas' | 'entregas' | 'facturas'
  title: string // "Oferta de ventas"
  listTitle: string // "Ofertas de venta"
  udfTable: string // OQUT / ODLN / OINV
  udfFields: string[]
}

export const OFERTAS_CONFIG: DocConfig = {
  module: 'ofertas',
  title: 'Oferta de ventas',
  listTitle: 'Ofertas de venta',
  udfTable: 'OQUT',
  udfFields: [
    'U_ViadelPedido', 'U_Anticipo', 'U_TipoPedidos', 'U_ValorAmortFact', 'U_ValorPagar', 'U_PorcAmortizacionFa',
    'U_TipoVentas', 'U_Bloqueado', 'U_TipoRadicacionFact', 'U_HBT_TipoFactura', 'U_TipoFacturacion', 'U_Estado_Oferta_Venta',
  ],
}

const PAGE = 20
const qty = (n: any) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })
function optLabel(opts: { value: any; label: string }[], v: any) {
  const o = opts.find(x => String(x.value) === String(v))
  return o ? o.label : v ?? ''
}

export default function DocumentModule({ config, onBack }: { config: DocConfig; onBack: () => void }) {
  const [selected, setSelected] = useState<number | null>(null)
  return (
    <div className={s.workspace} id={`sap-module-${config.module}`}>
      <div className={s.breadcrumb}>
        <button type="button" onClick={onBack}>Panel Principal</button>
        <span>›</span>
        <button type="button" onClick={() => setSelected(null)}>{config.listTitle}</button>
        {selected && (<><span>›</span><span>DocEntry {selected}</span></>)}
      </div>
      {selected ? <DocDetail config={config} docEntry={selected} onBack={() => setSelected(null)} /> : <DocList config={config} onOpen={setSelected} />}
    </div>
  )
}

function DocList({ config, onOpen }: { config: DocConfig; onOpen: (e: number) => void }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [slpF, setSlpF] = useState('')
  const [skip, setSkip] = useState(0)
  const [rows, setRows] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const slp = useLookup('salespersons')

  const load = useCallback(async (sk: number) => {
    setLoading(true); setErr(null)
    try {
      const p = new URLSearchParams({ top: String(PAGE), skip: String(sk) })
      if (q.trim()) p.set('q', q.trim())
      if (status) p.set('status', status)
      if (from) p.set('from', from)
      if (to) p.set('to', to)
      if (slpF) p.set('salesPerson', slpF)
      const r = await apiGet(`/api/sap/m/${config.module}?${p}`)
      setRows(r.rows); setHasMore(r.hasMore); setSkip(sk)
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }, [q, status, from, to, slpF, config.module])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Window title={config.listTitle} subtitle="SAP Business One">
      <div className={s.filters}>
        <label>Buscar <input id={`${config.module}-q`} className={s.input} placeholder="Nº documento, cliente o código" value={q}
          onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(0)} /></label>
        <label>Estado
          <select className={s.select} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Todos</option><option value="open">Abiertos</option><option value="closed">Cerrados</option><option value="cancelled">Cancelados</option>
          </select>
        </label>
        <label>Desde <input type="date" className={s.input} value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>Hasta <input type="date" className={s.input} value={to} onChange={e => setTo(e.target.value)} /></label>
        <label>Empleado de ventas
          <select className={s.select} value={slpF} onChange={e => setSlpF(e.target.value)}>
            <option value="">Todos</option>
            {slp.opts.map(o => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <button type="button" className={s.btnOk} onClick={() => load(0)} id={`${config.module}-buscar`}>Buscar</button>
        {loading && <span className={s.muted}>Consultando SAP…</span>}
      </div>
      {err && <div className={s.err}>{err}</div>}
      <div className={s.gridWrap} style={{ margin: 8 }}>
        <table className={s.grid} id={`${config.module}-grid`}>
          <thead>
            <tr>
              <th>Nº</th><th>Fecha</th><th>Válido hasta</th><th>Código cliente</th><th>Nombre cliente</th><th>Referencia</th>
              <th>Empleado de ventas</th><th className={s.num}>IVA</th><th className={s.num}>Total documento</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.DocEntry} className={s.rowClickable} onClick={() => onOpen(r.DocEntry)}>
                <td><span className={s.arrow}>➜</span>{r.DocNum}</td>
                <td>{fmtDate(r.DocDate)}</td>
                <td>{fmtDate(r.DocDueDate)}</td>
                <td>{r.CardCode}</td>
                <td>{r.CardName}</td>
                <td>{r.NumAtCard}</td>
                <td>{optLabel(slp.opts, r.SalesPersonCode)}</td>
                <td className={s.num}>{fmtMoney(r.VatSum)}</td>
                <td className={s.num}>{fmtMoney(r.DocTotal)}</td>
                <td><StatusBadge row={r} /></td>
              </tr>
            ))}
            {!loading && !rows.length && !err && <tr><td colSpan={10} className={s.muted}>Sin resultados</td></tr>}
          </tbody>
        </table>
      </div>
      <div className={s.actions}>
        <button type="button" className={s.btn} disabled={skip === 0 || loading} onClick={() => load(Math.max(skip - PAGE, 0))}>◀ Anterior</button>
        <button type="button" className={s.btn} disabled={!hasMore || loading} onClick={() => load(skip + PAGE)}>Siguiente ▶</button>
        <span className={s.muted}>Registros {rows.length ? skip + 1 : 0}–{skip + rows.length}</span>
        <span className={s.spacer} />
        <span className={s.muted}>Datos en vivo desde SAP (Service Layer)</span>
      </div>
    </Window>
  )
}

const TABS = ['Contenido', 'Logística', 'Finanzas']

function DocDetail({ config, docEntry, onBack }: { config: DocConfig; docEntry: number; onBack: () => void }) {
  const [doc, setDoc] = useState<any>(null)
  const [contact, setContact] = useState<string>('')
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState(TABS[0])
  const slp = useLookup('salespersons')
  const pt = useLookup('paymentterms')
  const whs = useLookup('warehouses')

  useEffect(() => {
    setDoc(null); setErr(null); setContact('')
    apiGet(`/api/sap/m/${config.module}/${docEntry}`)
      .then(r => {
        setDoc(r.data)
        if (r.data?.ContactPersonCode && r.data?.CardCode) {
          apiGet(`/api/sap/lookups/bpdetail?cardCode=${encodeURIComponent(r.data.CardCode)}`)
            .then(b => setContact((b.data?.ContactEmployees || []).find((c: any) => c.InternalCode === r.data.ContactPersonCode)?.Name || ''))
            .catch(() => {})
        }
      })
      .catch(e => setErr(e.message))
  }, [config.module, docEntry])

  if (err) return <div className={s.err}>{err}</div>
  if (!doc) return <div className={s.status}>Consultando SAP…</div>

  const lines: any[] = doc.DocumentLines || []
  const subtotal = lines.reduce((a, l) => a + (l.LineTotal || 0), 0)
  const estado = doc.Cancelled === 'tYES' ? 'Cancelado' : doc.DocumentStatus === 'bost_Close' ? 'Cerrado' : 'Abierto'

  return (
    <Window title={config.title} subtitle={`Nº ${doc.DocNum} • ${doc.CardName}`}>
      <div className={s.windowBody}>
        <div className={s.main} id="doc-detail">
          <div className={s.headerGrid}>
            <div className={s.col}>
              <Field label="Cliente" req><TextInput value={doc.CardCode} /></Field>
              <Field label="Nombre"><TextInput value={doc.CardName} /></Field>
              <Field label="Persona de contacto"><TextInput value={contact || (doc.ContactPersonCode ?? '')} /></Field>
              <Field label="Nº referencia del cliente"><TextInput value={doc.NumAtCard} /></Field>
              <Field label="Moneda"><TextInput value={doc.DocCurrency} /></Field>
            </div>
            <div className={s.col}>
              <Field label="Nº"><div className={s.inputLink}><TextInput value={`Serie ${doc.Series}`} /><TextInput value={doc.DocNum} /></div></Field>
              <Field label="Estado"><TextInput value={estado} /></Field>
              <Field label="Fecha de contabilización"><TextInput value={fmtDate(doc.DocDate)} /></Field>
              <Field label={config.module === 'ofertas' ? 'Válido hasta' : 'Fecha de vencimiento'}><TextInput value={fmtDate(doc.DocDueDate)} /></Field>
              <Field label="Fecha del documento"><TextInput value={fmtDate(doc.TaxDate)} /></Field>
            </div>
          </div>

          <Tabs tabs={TABS} active={tab} onChange={setTab} />
          <div className={s.tabBody}>
            {tab === 'Contenido' && (
              <div className={s.gridWrap}>
                <table className={s.grid} id="doc-lines-grid">
                  <thead>
                    <tr>
                      <th>#</th><th>Número de artículo</th><th>Descripción</th><th className={s.num}>Cantidad</th><th className={s.num}>Pendiente</th>
                      <th className={s.num}>Precio unitario</th><th className={s.num}>% desc.</th><th>Indicador IVA</th>
                      <th className={s.num}>Total (ML)</th><th>Almacén</th><th>Centro de costo</th><th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(l => (
                      <tr key={l.LineNum}>
                        <td>{l.LineNum + 1}</td>
                        <td>{l.ItemCode}</td>
                        <td>{l.ItemDescription}</td>
                        <td className={s.num}>{qty(l.Quantity)}</td>
                        <td className={s.num}>{qty(l.RemainingOpenQuantity)}</td>
                        <td className={s.num}>{fmtMoney(l.UnitPrice)}</td>
                        <td className={s.num}>{qty(l.DiscountPercent)}</td>
                        <td>{l.TaxCode}</td>
                        <td className={s.num}>{fmtMoney(l.LineTotal)}</td>
                        <td title={optLabel(whs.opts, l.WarehouseCode)}>{l.WarehouseCode}</td>
                        <td>{l.CostingCode}</td>
                        <td>{l.LineStatus === 'bost_Close' ? 'Cerrada' : 'Abierta'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tab === 'Logística' && (
              <div className={s.twoCols}>
                <div className={s.col}>
                  <Field label="Destino"><textarea className={s.textarea} readOnly value={doc.Address2 || ''} /></Field>
                  <Field label="Destinatario factura"><textarea className={s.textarea} readOnly value={doc.Address || ''} /></Field>
                </div>
                <div className={s.col}>
                  <Field label="ID destino"><TextInput value={doc.ShipToCode} /></Field>
                  <Field label="ID destinatario factura"><TextInput value={doc.PayToCode} /></Field>
                  <Field label="Clase de expedición"><TextInput value={doc.TransportationCode ?? ''} /></Field>
                </div>
              </div>
            )}
            {tab === 'Finanzas' && (
              <div className={s.twoCols}>
                <div className={s.col}>
                  <Field label="Condiciones de pago"><TextInput value={optLabel(pt.opts, doc.PaymentGroupCode)} /></Field>
                  <Field label="Proyecto"><TextInput value={doc.Project} /></Field>
                </div>
                <div className={s.col}>
                  <Field label="Indicador"><TextInput value={doc.Indicator} /></Field>
                  <Field label="Nº de cuotas"><TextInput value={doc.NumberOfInstallments ?? ''} /></Field>
                </div>
              </div>
            )}
          </div>

          <div className={s.footerGrid}>
            <div className={s.col}>
              <Field label="Empleado de ventas"><TextInput value={optLabel(slp.opts, doc.SalesPersonCode)} /></Field>
              <Field label="Comentarios"><textarea className={s.textarea} readOnly value={doc.Comments || ''} /></Field>
            </div>
            <div className={`${s.col} ${s.totals}`}>
              <Field label="Total antes del descuento"><TextInput className={s.num} value={fmtMoney(subtotal)} /></Field>
              <Field label="Descuento %"><TextInput className={s.num} value={`${qty(doc.DiscountPercent)} % • ${fmtMoney(doc.TotalDiscount)}`} /></Field>
              <Field label="Impuesto"><TextInput className={s.num} value={fmtMoney(doc.VatSum)} /></Field>
              {config.module === 'facturas' && <Field label="Importe aplicado"><TextInput className={s.num} value={fmtMoney(doc.PaidToDate)} /></Field>}
              <div className={s.totalStrong}><Field label="Total del documento"><TextInput className={s.num} value={fmtMoney(doc.DocTotal)} /></Field></div>
            </div>
          </div>
        </div>
        <UdfPanel table={config.udfTable} fields={config.udfFields} values={doc} />
      </div>
      <div className={s.actions}>
        <button type="button" className={s.btnOk} onClick={onBack}>OK</button>
        <span className={s.spacer} />
        <span className={s.muted}>Solo lectura • Crear / actualizar / cancelar / cerrar: próximamente</span>
      </div>
    </Window>
  )
}
