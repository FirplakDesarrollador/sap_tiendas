'use client'
// Módulo "Socios de negocio" (Clientes): lista y ficha desde SAP Business One (solo lectura en esta versión)
import React, { useCallback, useEffect, useState } from 'react'
import s from './sap.module.css'
import { apiGet, fmtMoney, fmtDate } from './sapApi'
import { Field, TextInput, Tabs, Window, useLookup } from './ui'
import CrearClienteForm from './CrearClienteForm'

const PAGE = 20

function optLabel(opts: { value: any; label: string }[], v: any) {
  const o = opts.find(x => String(x.value) === String(v))
  return o ? o.label : v ?? ''
}

export default function ClientesModule({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  return (
    <div className={s.workspace} id="sap-module-clientes">
      <div className={s.breadcrumb}>
        <button type="button" onClick={onBack}>Panel Principal</button>
        <span>›</span>
        <button type="button" onClick={() => setSelected(null)}>Socios de negocio</button>
        {selected && (<><span>›</span><span>{selected}</span></>)}
      </div>
      {selected ? <ClienteDetail cardCode={selected} onBack={() => setSelected(null)} /> : <ClientesList onOpen={setSelected} onNew={() => setCreating(true)} />}
      <CrearClienteForm open={creating} onClose={() => setCreating(false)} onCreated={code => { setCreating(false); setSelected(code) }} />
    </div>
  )
}

function ClientesList({ onOpen, onNew }: { onOpen: (code: string) => void; onNew: () => void }) {
  const [q, setQ] = useState('')
  const [property, setProperty] = useState('')
  const [group, setGroup] = useState('')
  const [skip, setSkip] = useState(0)
  const [rows, setRows] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const groups = useLookup('bpgroups')
  const props = useLookup('properties')
  const slp = useLookup('salespersons')

  const load = useCallback(async (sk: number) => {
    setLoading(true); setErr(null)
    try {
      const p = new URLSearchParams({ top: String(PAGE), skip: String(sk) })
      if (q.trim()) p.set('q', q.trim())
      if (property) p.set('property', property)
      if (group) p.set('group', group)
      const r = await apiGet(`/api/sap/m/clientes?${p}`)
      setRows(r.rows); setHasMore(r.hasMore); setSkip(sk)
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }, [q, property, group])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Window title="Socios de negocio" subtitle="Clientes • SAP Business One">
      <div className={s.filters}>
        <label>Buscar <input id="clientes-q" className={s.input} placeholder="Código, nombre o NIT" value={q}
          onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(0)} /></label>
        <label>Grupo
          <select className={s.select} value={group} onChange={e => setGroup(e.target.value)}>
            <option value="">Todos</option>
            {groups.opts.map(o => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label>Propiedad
          <select className={s.select} value={property} onChange={e => setProperty(e.target.value)}>
            <option value="">Todas</option>
            {props.opts.map(o => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <button type="button" className={s.btnOk} onClick={() => load(0)} id="clientes-buscar">Buscar</button>
        {loading && <span className={s.muted}>Consultando SAP…</span>}
        <span className={s.spacer} />
        <button type="button" className={s.btnNew} onClick={onNew} id="clientes-nuevo">+ Nuevo cliente</button>
      </div>
      {err && <div className={s.err}>{err}</div>}
      <div className={s.gridWrap} style={{ margin: 8 }}>
        <table className={s.grid} id="clientes-grid">
          <thead>
            <tr>
              <th>#</th><th>Código SN</th><th>Nombre SN</th><th>NIT / CC</th><th>Grupo</th><th>Empleado de ventas</th>
              <th>Teléfono</th><th>Correo</th><th>Ciudad</th><th className={s.num}>Saldo cuenta</th><th>Creado</th><th>Activo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.CardCode} className={s.rowClickable} onClick={() => onOpen(r.CardCode)}>
                <td>{skip + i + 1}</td>
                <td><span className={s.arrow}>➜</span>{r.CardCode}</td>
                <td>{r.CardName}</td>
                <td>{r.FederalTaxID}</td>
                <td>{optLabel(groups.opts, r.GroupCode)}</td>
                <td>{optLabel(slp.opts, r.SalesPersonCode)}</td>
                <td>{r.Phone1 || r.Cellular}</td>
                <td>{r.EmailAddress}</td>
                <td>{r.City}</td>
                <td className={s.num}>{fmtMoney(r.CurrentAccountBalance)}</td>
                <td>{fmtDate(r.CreateDate)}</td>
                <td>{r.Valid === 'tYES' ? 'Sí' : 'No'}</td>
              </tr>
            ))}
            {!loading && !rows.length && !err && <tr><td colSpan={12} className={s.muted}>Sin resultados</td></tr>}
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

const TABS = ['General', 'Personas de contacto', 'Direcciones', 'Condiciones de pago', 'Finanzas', 'Propiedades', 'Localización HBT']

const HBT_FIELDS: [string, string][] = [
  ['U_HBT_TipDoc', 'Tipo de documento'], ['U_HBT_TipEnt', 'Tipo de entidad'], ['U_HBT_RegTrib', 'Régimen tributario'],
  ['U_HBT_Nombres', 'Nombres'], ['U_HBT_Apellido1', 'Primer apellido'], ['U_HBT_Apellido2', 'Segundo apellido'],
  ['U_HBT_MunMed', 'Municipio'], ['U_HBT_Nacional', 'Nacionalidad'], ['U_HBT_ActEco', 'Actividad económica'],
  ['U_HBT_RegFis', 'Régimen fiscal'], ['U_HBT_ResFis', 'Responsabilidad fiscal'], ['U_HBT_MedPag', 'Medio de pago'],
  ['U_HBT_MailRecep_FE', 'Correo recepción FE'], ['U_HBT_Residente', 'Residente'], ['U_HBT_ConsumFinal', 'Consumidor final'],
]
const UDF_FIELDS: [string, string][] = [
  ['U_CentrodeCtos', 'Centro de costo'], ['U_SubGroupCode', 'Subgrupo cliente'], ['U_CumplimientoPago', 'Cumplimiento pago'],
  ['U_Certificaciones', 'Certificaciones'], ['U_CamaraCcio', 'Cámara de comercio'], ['U_Manejo', 'Manejo'],
  ['U_AutMayorista', 'Autorizado mayorista'], ['U_EsAutorret', 'Autorretenedor'],
]

function ClienteDetail({ cardCode, onBack }: { cardCode: string; onBack: () => void }) {
  const [bp, setBp] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState(TABS[0])
  const groups = useLookup('bpgroups')
  const slp = useLookup('salespersons')
  const pl = useLookup('pricelists')
  const pt = useLookup('paymentterms')
  const terr = useLookup('territories')
  const props = useLookup('properties')

  useEffect(() => {
    setBp(null); setErr(null)
    apiGet(`/api/sap/m/clientes/${encodeURIComponent(cardCode)}`).then(r => setBp(r.data)).catch(e => setErr(e.message))
  }, [cardCode])

  if (err) return <div className={s.err}>{err}</div>
  if (!bp) return <div className={s.status}>Consultando SAP…</div>

  const v = (k: string) => bp[k] ?? ''
  return (
    <Window title="Datos maestros socio de negocios" subtitle={`${bp.CardCode} • ${bp.CardName}`}>
      <div className={`${s.windowBody} ${s.windowBodySingle}`}>
        <div className={s.main} id="cliente-detail">
          <div className={s.headerGrid}>
            <div className={s.col}>
              <Field label="Código" req><TextInput value={bp.CardCode} /></Field>
              <Field label="Clase"><TextInput value={bp.CardType === 'cCustomer' ? 'Cliente' : bp.CardType} /></Field>
              <Field label="Nombre" req><TextInput value={bp.CardName} /></Field>
              <Field label="Nombre extranjero"><TextInput value={v('CardForeignName')} /></Field>
              <Field label="Grupo"><TextInput value={optLabel(groups.opts, bp.GroupCode)} /></Field>
              <Field label="Moneda"><TextInput value={bp.Currency === '##' ? 'Todas las monedas' : v('Currency')} /></Field>
              <Field label="NIT / Nº identificación"><TextInput value={v('FederalTaxID')} /></Field>
            </div>
            <div className={s.col}>
              <Field label="Saldo de cuenta"><TextInput value={fmtMoney(bp.CurrentAccountBalance)} /></Field>
              <Field label="Entregas"><TextInput value={fmtMoney(bp.OpenDeliveryNotesBalance)} /></Field>
              <Field label="Pedidos de cliente"><TextInput value={fmtMoney(bp.OpenOrdersBalance)} /></Field>
              <Field label="Fecha de creación"><TextInput value={fmtDate(bp.CreateDate)} /></Field>
              <Field label="Activo"><TextInput value={bp.Valid === 'tYES' ? 'Sí' : 'No'} /></Field>
            </div>
          </div>

          <Tabs tabs={TABS} active={tab} onChange={setTab} />
          <div className={s.tabBody}>
            {tab === 'General' && (
              <div className={s.twoCols}>
                <div className={s.col}>
                  <Field label="Teléfono 1"><TextInput value={v('Phone1')} /></Field>
                  <Field label="Teléfono 2"><TextInput value={v('Phone2')} /></Field>
                  <Field label="Teléfono móvil"><TextInput value={v('Cellular')} /></Field>
                  <Field label="Correo electrónico"><TextInput value={v('EmailAddress')} /></Field>
                  <Field label="Persona de contacto"><TextInput value={v('ContactPerson')} /></Field>
                </div>
                <div className={s.col}>
                  <Field label="Empleado de ventas"><TextInput value={optLabel(slp.opts, bp.SalesPersonCode)} /></Field>
                  <Field label="Territorio"><TextInput value={optLabel(terr.opts, bp.Territory)} /></Field>
                  <Field label="Comentarios"><TextInput value={v('FreeText')} /></Field>
                  {UDF_FIELDS.map(([k, l]) => <Field key={k} label={l}><TextInput value={v(k)} /></Field>)}
                </div>
              </div>
            )}
            {tab === 'Personas de contacto' && (
              <table className={s.grid}>
                <thead><tr><th>ID</th><th>Nombre</th><th>Teléfono 1</th><th>Móvil</th><th>Correo</th><th>Cargo</th></tr></thead>
                <tbody>
                  {(bp.ContactEmployees || []).map((c: any) => (
                    <tr key={c.InternalCode}><td>{c.InternalCode}</td><td>{c.Name}</td><td>{c.Phone1}</td><td>{c.MobilePhone}</td><td>{c.E_Mail}</td><td>{c.Position}</td></tr>
                  ))}
                  {!(bp.ContactEmployees || []).length && <tr><td colSpan={6} className={s.muted}>Sin personas de contacto</td></tr>}
                </tbody>
              </table>
            )}
            {tab === 'Direcciones' && (
              <table className={s.grid}>
                <thead><tr><th>Tipo</th><th>ID dirección</th><th>Calle</th><th>Ciudad</th><th>Departamento</th><th>País</th><th>Municipio</th><th>Teléfono</th></tr></thead>
                <tbody>
                  {(bp.BPAddresses || []).map((a: any, i: number) => (
                    <tr key={i}>
                      <td>{a.AddressType === 'bo_BillTo' ? 'Destinatario factura' : 'Destino'}{(a.AddressType === 'bo_BillTo' ? bp.BilltoDefault : bp.ShipToDefault) === a.AddressName ? ' (pred.)' : ''}</td>
                      <td>{a.AddressName}</td><td>{a.Street}</td><td>{a.City}</td><td>{a.State}</td><td>{a.Country}</td><td>{a.U_HBT_MunMed}</td><td>{a.U_Telefono}</td>
                    </tr>
                  ))}
                  {!(bp.BPAddresses || []).length && <tr><td colSpan={8} className={s.muted}>Sin direcciones</td></tr>}
                </tbody>
              </table>
            )}
            {tab === 'Condiciones de pago' && (
              <div className={s.col}>
                <Field label="Condición de pago"><TextInput value={optLabel(pt.opts, bp.PayTermsGrpCode)} /></Field>
                <Field label="Lista de precios"><TextInput value={optLabel(pl.opts, bp.PriceListNum)} /></Field>
                <Field label="Límite de crédito"><TextInput value={fmtMoney(bp.CreditLimit)} /></Field>
                <Field label="% descuento total"><TextInput value={v('DiscountPercent')} /></Field>
              </div>
            )}
            {tab === 'Finanzas' && (
              <div className={s.twoCols}>
                <div className={s.col}>
                  <Field label="Cuenta asociada"><TextInput value={v('DebitorAccount')} /></Field>
                  <Field label="Sujeto a retención"><TextInput value={bp.SubjectToWithholdingTax === 'boYES' ? 'Sí' : 'No'} /></Field>
                  <Field label="Sujeto a impuesto"><TextInput value={bp.VatLiable === 'vLiable' ? 'Sujeto' : v('VatLiable')} /></Field>
                </div>
                <div className={s.col}>
                  <div className={s.sectionTitle}>Códigos de retención</div>
                  {(bp.BPWithholdingTaxCollection || []).map((w: any) => <div key={w.WTCode}>{w.WTCode}</div>)}
                </div>
              </div>
            )}
            {tab === 'Propiedades' && (
              <div className={s.propsGrid}>
                {props.opts.map(o => (
                  <label key={String(o.value)} className={s.checkRow}>
                    <input type="checkbox" readOnly checked={bp[`Properties${o.value}`] === 'tYES'} /> {o.label}
                  </label>
                ))}
              </div>
            )}
            {tab === 'Localización HBT' && (
              <div className={s.twoCols}>
                {HBT_FIELDS.map(([k, l]) => <Field key={k} label={l}><TextInput value={v(k)} /></Field>)}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={s.actions}>
        <button type="button" className={s.btnOk} onClick={onBack}>OK</button>
        <span className={s.spacer} />
        <span className={s.muted}>Solo lectura • Creación y actualización de clientes: próximamente</span>
      </div>
    </Window>
  )
}
