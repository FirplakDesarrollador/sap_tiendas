'use client'
// Pagos recibidos (IncomingPayments / ORCT): lista y detalle desde SAP, solo lectura
import React, { useCallback, useEffect, useState } from 'react'
import s from './sap.module.css'
import { apiGet, fmtMoney, fmtDate } from './sapApi'
import { Field, TextInput, Tabs, Window, UdfPanel, useLookup } from './ui'

const PAGE = 20
const UDF_FIELDS = [
  'U_TipoRC', 'U_asesor', 'U_PorcAmortizacionRC', 'U_RCAntInicial', 'U_NumPed', 'U_VlorOC_Cot',
  'U_NumRCProvisional', 'U_Rec_Prov_Fecha', 'U_EmpleadoRCP', 'U_CodTecero', 'U_DescripTercero',
  'U_HBT_AreVal', 'U_HBT_PagoAnticipo',
]
const DOC_TYPE: Record<string, string> = { rCustomer: 'Cliente', rSupplier: 'Proveedor', rAccount: 'Cuenta' }
const INV_TYPE: Record<string, string> = {
  it_Invoice: 'Factura', it_CredItnote: 'Nota crédito', it_DownPayment: 'Factura anticipo',
  it_JournalEntry: 'Asiento', it_PaymentAdvice: 'Pago', it_Receipt: 'Pago recibido',
}
const sum = (arr: any[], k: string) => (arr || []).reduce((a, x) => a + (Number(x[k]) || 0), 0)
function optLabel(opts: { value: any; label: string }[], v: any) {
  const o = opts.find(x => String(x.value) === String(v))
  return o ? o.label : v ?? ''
}
function Badge({ row }: { row: any }) {
  return row.Cancelled === 'tYES'
    ? <span className={`${s.badge} ${s.bCancel}`}>Cancelado</span>
    : <span className={`${s.badge} ${s.bOpen}`}>Activo</span>
}

export default function PagosModule({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<number | null>(null)
  return (
    <div className={s.workspace} id="sap-module-pagos">
      <div className={s.breadcrumb}>
        <button type="button" onClick={onBack}>Panel Principal</button>
        <span>›</span>
        <button type="button" onClick={() => setSelected(null)}>Pagos recibidos</button>
        {selected && (<><span>›</span><span>DocEntry {selected}</span></>)}
      </div>
      {selected ? <PagoDetail docEntry={selected} onBack={() => setSelected(null)} /> : <PagoList onOpen={setSelected} />}
    </div>
  )
}

function PagoList({ onOpen }: { onOpen: (e: number) => void }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
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
      const r = await apiGet(`/api/sap/m/pagos?${p}`)
      setRows(r.rows); setHasMore(r.hasMore); setSkip(sk)
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }, [q, status, from, to])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Window title="Pagos recibidos" subtitle="SAP Business One">
      <div className={s.filters}>
        <label>Buscar <input id="pagos-q" className={s.input} placeholder="Nº pago, cliente o código" value={q}
          onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(0)} /></label>
        <label>Estado
          <select className={s.select} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Todos</option><option value="open">Activos</option><option value="cancelled">Cancelados</option>
          </select>
        </label>
        <label>Desde <input type="date" className={s.input} value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>Hasta <input type="date" className={s.input} value={to} onChange={e => setTo(e.target.value)} /></label>
        <button type="button" className={s.btnOk} onClick={() => load(0)} id="pagos-buscar">Buscar</button>
        {loading && <span className={s.muted}>Consultando SAP…</span>}
      </div>
      {err && <div className={s.err}>{err}</div>}
      <div className={s.gridWrap} style={{ margin: 8 }}>
        <table className={s.grid} id="pagos-grid">
          <thead>
            <tr>
              <th>Nº</th><th>Fecha</th><th>Código cliente</th><th>Nombre cliente</th><th>Tipo RC</th><th>Asesor</th>
              <th>Referencia</th><th className={s.num}>Transferencia</th><th className={s.num}>Efectivo</th><th>Comentarios</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.DocEntry} className={s.rowClickable} onClick={() => onOpen(r.DocEntry)}>
                <td><span className={s.arrow}>➜</span>{r.DocNum}</td>
                <td>{fmtDate(r.DocDate)}</td>
                <td>{r.CardCode}</td>
                <td>{r.CardName}</td>
                <td>{r.U_TipoRC}</td>
                <td>{r.U_asesor ? optLabel(slp.opts, r.U_asesor) : ''}</td>
                <td>{r.CounterReference}</td>
                <td className={s.num}>{r.TransferSum ? fmtMoney(r.TransferSum) : ''}</td>
                <td className={s.num}>{r.CashSum ? fmtMoney(r.CashSum) : ''}</td>
                <td>{r.Remarks}</td>
                <td><Badge row={r} /></td>
              </tr>
            ))}
            {!loading && !rows.length && !err && <tr><td colSpan={11} className={s.muted}>Sin resultados</td></tr>}
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

const TABS = ['Documentos pagados', 'Medios de pago']

function PagoDetail({ docEntry, onBack }: { docEntry: number; onBack: () => void }) {
  const [doc, setDoc] = useState<any>(null)
  const [refs, setRefs] = useState<Record<number, any>>({})
  const [contact, setContact] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState(TABS[0])
  const slp = useLookup('salespersons')

  useEffect(() => {
    setDoc(null); setErr(null); setRefs({}); setContact('')
    apiGet(`/api/sap/m/pagos/${docEntry}`)
      .then(r => {
        const d = r.data
        setDoc(d)
        const inv = (d?.PaymentInvoices || []).filter((x: any) => x.InvoiceType === 'it_Invoice').map((x: any) => x.DocEntry)
        if (inv.length) {
          apiGet(`/api/sap/lookups/invoicerefs?entries=${inv.join(',')}`)
            .then(x => setRefs(Object.fromEntries((x.rows || []).map((i: any) => [i.DocEntry, i]))))
            .catch(() => {})
        }
        if (d?.ContactPersonCode && d?.CardCode) {
          apiGet(`/api/sap/lookups/bpdetail?cardCode=${encodeURIComponent(d.CardCode)}`)
            .then(b => setContact((b.data?.ContactEmployees || []).find((c: any) => c.InternalCode === d.ContactPersonCode)?.Name || ''))
            .catch(() => {})
        }
      })
      .catch(e => setErr(e.message))
  }, [docEntry])

  if (err) return <div className={s.err}>{err}</div>
  if (!doc) return <div className={s.status}>Consultando SAP…</div>

  const invs: any[] = doc.PaymentInvoices || []
  const checks: any[] = doc.PaymentChecks || []
  const cards: any[] = doc.PaymentCreditCards || []
  const checkSum = sum(checks, 'CheckSum')
  const cardSum = sum(cards, 'CreditSum')
  const total = (doc.CashSum || 0) + (doc.TransferSum || 0) + checkSum + cardSum
  const applied = sum(invs, 'SumApplied')

  return (
    <Window title="Pagos recibidos" subtitle={`Nº ${doc.DocNum} • ${doc.CardName || ''}`}>
      <div className={s.windowBody}>
        <div className={s.main} id="pago-detail">
          <div className={s.headerGrid}>
            <div className={s.col}>
              <Field label="Tipo"><TextInput value={DOC_TYPE[doc.DocType] || doc.DocType} /></Field>
              <Field label="Código" req><TextInput value={doc.CardCode} /></Field>
              <Field label="Nombre"><TextInput value={doc.CardName} /></Field>
              <Field label="Persona de contacto"><TextInput value={contact || (doc.ContactPersonCode ?? '')} /></Field>
              <Field label="Destinatario de pago"><TextInput value={doc.PayToCode} /></Field>
            </div>
            <div className={s.col}>
              <Field label="Nº"><div className={s.inputLink}><TextInput value={`Serie ${doc.Series}`} /><TextInput value={doc.DocNum} /></div></Field>
              <Field label="Estado"><TextInput value={doc.Cancelled === 'tYES' ? 'Cancelado' : 'Activo'} /></Field>
              <Field label="Fecha de contabilización"><TextInput value={fmtDate(doc.DocDate)} /></Field>
              <Field label="Fecha de vencimiento"><TextInput value={fmtDate(doc.DueDate)} /></Field>
              <Field label="Fecha del documento"><TextInput value={fmtDate(doc.TaxDate)} /></Field>
              <Field label="Referencia"><TextInput value={doc.CounterReference} /></Field>
            </div>
          </div>

          <Tabs tabs={TABS} active={tab} onChange={setTab} />
          <div className={s.tabBody}>
            {tab === 'Documentos pagados' && (
              <div className={s.gridWrap}>
                <table className={s.grid} id="pago-invoices-grid">
                  <thead>
                    <tr>
                      <th>#</th><th>Tipo</th><th>Nº documento</th><th>Fecha</th><th>Vencimiento</th><th>Ref. cliente</th>
                      <th className={s.num}>Total documento</th><th className={s.num}>Saldo actual</th><th className={s.num}>Total pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invs.map(l => {
                      const r = l.InvoiceType === 'it_Invoice' ? refs[l.DocEntry] : null
                      return (
                        <tr key={l.LineNum}>
                          <td>{l.LineNum + 1}</td>
                          <td>{INV_TYPE[l.InvoiceType] || l.InvoiceType}</td>
                          <td>{r ? r.DocNum : `DocEntry ${l.DocEntry}`}</td>
                          <td>{r ? fmtDate(r.DocDate) : ''}</td>
                          <td>{r ? fmtDate(r.DocDueDate) : ''}</td>
                          <td>{r?.NumAtCard || ''}</td>
                          <td className={s.num}>{r ? fmtMoney(r.DocTotal) : ''}</td>
                          <td className={s.num}>{r ? fmtMoney((r.DocTotal || 0) - (r.PaidToDate || 0)) : ''}</td>
                          <td className={s.num}>{fmtMoney(l.SumApplied)}</td>
                        </tr>
                      )
                    })}
                    {!invs.length && <tr><td colSpan={9} className={s.muted}>Pago a cuenta / anticipo: sin documentos aplicados</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {tab === 'Medios de pago' && (
              <div className={s.twoCols}>
                <div className={s.col}>
                  <Field label="Transferencia"><TextInput className={s.num} value={fmtMoney(doc.TransferSum)} /></Field>
                  <Field label="Cuenta transferencia"><TextInput value={doc.TransferAccount} /></Field>
                  <Field label="Fecha transferencia"><TextInput value={fmtDate(doc.TransferDate)} /></Field>
                  <Field label="Referencia transf."><TextInput value={doc.TransferReference} /></Field>
                </div>
                <div className={s.col}>
                  <Field label="Efectivo"><TextInput className={s.num} value={fmtMoney(doc.CashSum)} /></Field>
                  <Field label="Cuenta efectivo"><TextInput value={doc.CashAccount} /></Field>
                  <Field label={`Cheques (${checks.length})`}><TextInput className={s.num} value={fmtMoney(checkSum)} /></Field>
                  <Field label={`Tarjetas (${cards.length})`}><TextInput className={s.num} value={fmtMoney(cardSum)} /></Field>
                </div>
              </div>
            )}
          </div>

          <div className={s.footerGrid}>
            <div className={s.col}>
              <Field label="Asesor"><TextInput value={doc.U_asesor ? optLabel(slp.opts, doc.U_asesor) : ''} /></Field>
              <Field label="Comentarios"><textarea className={s.textarea} readOnly value={doc.Remarks || ''} /></Field>
              <Field label="Comentario asiento"><TextInput value={doc.JournalRemarks} /></Field>
            </div>
            <div className={`${s.col} ${s.totals}`}>
              <Field label="Importe aplicado"><TextInput className={s.num} value={fmtMoney(applied)} /></Field>
              <Field label="Pago a cuenta"><TextInput className={s.num} value={fmtMoney(Math.max(total - applied, 0))} /></Field>
              <div className={s.totalStrong}><Field label="Total del pago"><TextInput className={s.num} value={fmtMoney(total)} /></Field></div>
            </div>
          </div>
        </div>
        <UdfPanel table="ORCT" fields={UDF_FIELDS} values={doc} />
      </div>
      <div className={s.actions}>
        <button type="button" className={s.btnOk} onClick={onBack}>OK</button>
        <span className={s.spacer} />
        <span className={s.muted}>Solo lectura • Registrar / cancelar pagos: próximamente</span>
      </div>
    </Window>
  )
}
