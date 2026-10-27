'use client'
// Módulo Inventario: artículos, stock por almacén y precios desde SAP Business One (solo lectura)
import React, { useCallback, useEffect, useState } from 'react'
import s from './sap.module.css'
import { apiGet, fmtMoney } from './sapApi'
import { Field, TextInput, Tabs, Window, useLookup } from './ui'

const PAGE = 25
const qty = (n: any) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })
const yes = (v: any) => (v === 'tYES' ? 'Sí' : 'No')
function optLabel(opts: { value: any; label: string }[], v: any) {
  const o = opts.find(x => String(x.value) === String(v))
  return o ? o.label : v ?? ''
}

export default function InventarioModule({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <div className={s.workspace} id="sap-module-inventario">
      <div className={s.breadcrumb}>
        <button type="button" onClick={onBack}>Panel Principal</button>
        <span>›</span>
        <button type="button" onClick={() => setSelected(null)}>Inventario</button>
        {selected && (<><span>›</span><span>{selected}</span></>)}
      </div>
      {selected ? <ItemDetail code={selected} onBack={() => setSelected(null)} /> : <ItemsList onOpen={setSelected} />}
    </div>
  )
}

function ItemsList({ onOpen }: { onOpen: (code: string) => void }) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [withStock, setWithStock] = useState(true)
  const [skip, setSkip] = useState(0)
  const [rows, setRows] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const groups = useLookup('itemgroups')

  const load = useCallback(async (sk: number) => {
    setLoading(true); setErr(null)
    try {
      const p = new URLSearchParams({ top: String(PAGE), skip: String(sk) })
      if (q.trim()) p.set('q', q.trim())
      if (group) p.set('group', group)
      if (withStock) p.set('withStock', '1')
      const r = await apiGet(`/api/sap/m/inventario?${p}`)
      setRows(r.rows); setHasMore(r.hasMore); setSkip(sk)
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }, [q, group, withStock])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Window title="Datos maestros de artículos" subtitle="Inventario • SAP Business One">
      <div className={s.filters}>
        <label>Buscar <input id="inv-q" className={s.input} placeholder="Código o descripción" value={q}
          onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(0)} /></label>
        <label>Grupo de artículos
          <select className={s.select} value={group} onChange={e => setGroup(e.target.value)}>
            <option value="">Todos</option>
            {groups.opts.map(o => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className={s.checkRow}><input type="checkbox" checked={withStock} onChange={e => setWithStock(e.target.checked)} /> Solo con stock</label>
        <button type="button" className={s.btnOk} onClick={() => load(0)} id="inv-buscar">Buscar</button>
        {loading && <span className={s.muted}>Consultando SAP…</span>}
      </div>
      {err && <div className={s.err}>{err}</div>}
      <div className={s.gridWrap} style={{ margin: 8 }}>
        <table className={s.grid} id="inv-grid">
          <thead>
            <tr>
              <th>#</th><th>Número de artículo</th><th>Descripción</th><th>Grupo</th><th>UM</th>
              <th className={s.num}>En stock</th><th className={s.num}>Comprometido</th><th className={s.num}>Pedido</th>
              <th className={s.num}>Disponible</th><th>Activo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.ItemCode} className={s.rowClickable} onClick={() => onOpen(r.ItemCode)}>
                <td>{skip + i + 1}</td>
                <td><span className={s.arrow}>➜</span>{r.ItemCode}</td>
                <td>{r.ItemName}</td>
                <td>{optLabel(groups.opts, r.ItemsGroupCode)}</td>
                <td>{r.InventoryUOM}</td>
                <td className={s.num}>{qty(r.QuantityOnStock)}</td>
                <td className={s.num}>{qty(r.QuantityOrderedByCustomers)}</td>
                <td className={s.num}>{qty(r.QuantityOrderedFromVendors)}</td>
                <td className={s.num}>{qty(r.QuantityOnStock - r.QuantityOrderedByCustomers + r.QuantityOrderedFromVendors)}</td>
                <td>{yes(r.Valid)}</td>
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

const TABS = ['Stock por almacén', 'Precios', 'Datos generales']

function ItemDetail({ code, onBack }: { code: string; onBack: () => void }) {
  const [it, setIt] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState(TABS[0])
  const [allWh, setAllWh] = useState(false)
  const groups = useLookup('itemgroups')
  const whs = useLookup('warehouses')
  const pls = useLookup('pricelists')

  useEffect(() => {
    setIt(null); setErr(null)
    apiGet(`/api/sap/m/inventario/${encodeURIComponent(code)}`).then(r => setIt(r.data)).catch(e => setErr(e.message))
  }, [code])

  if (err) return <div className={s.err}>{err}</div>
  if (!it) return <div className={s.status}>Consultando SAP…</div>

  const wh = (it.ItemWarehouseInfoCollection || []).filter((w: any) => allWh || w.InStock || w.Committed || w.Ordered)
  const tot = wh.reduce((a: any, w: any) => ({ s: a.s + (w.InStock || 0), c: a.c + (w.Committed || 0), o: a.o + (w.Ordered || 0) }), { s: 0, c: 0, o: 0 })
  const prices = (it.ItemPrices || []).filter((p: any) => p.Price)

  return (
    <Window title="Datos maestros de artículos" subtitle={`${it.ItemCode} • ${it.ItemName}`}>
      <div className={`${s.windowBody} ${s.windowBodySingle}`}>
        <div className={s.main} id="item-detail">
          <div className={s.headerGrid}>
            <div className={s.col}>
              <Field label="Número de artículo" req><TextInput value={it.ItemCode} /></Field>
              <Field label="Descripción"><TextInput value={it.ItemName} /></Field>
              <Field label="Nombre extranjero"><TextInput value={it.ForeignName} /></Field>
              <Field label="Grupo de artículos"><TextInput value={optLabel(groups.opts, it.ItemsGroupCode)} /></Field>
              <Field label="Código de barras"><TextInput value={it.BarCode} /></Field>
            </div>
            <div className={s.col}>
              <Field label="Artículo de inventario"><TextInput value={yes(it.InventoryItem)} /></Field>
              <Field label="Artículo de venta"><TextInput value={yes(it.SalesItem)} /></Field>
              <Field label="Artículo de compra"><TextInput value={yes(it.PurchaseItem)} /></Field>
              <Field label="Almacén por defecto"><TextInput value={optLabel(whs.opts, it.DefaultWarehouse)} /></Field>
              <Field label="Activo"><TextInput value={yes(it.Valid)} /></Field>
            </div>
          </div>
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
          <div className={s.tabBody}>
            {tab === 'Stock por almacén' && (
              <>
                <label className={s.checkRow}><input type="checkbox" checked={allWh} onChange={e => setAllWh(e.target.checked)} /> Mostrar almacenes sin movimiento</label>
                <div className={s.gridWrap}>
                  <table className={s.grid} id="item-stock-grid">
                    <thead><tr><th>Código almacén</th><th>Nombre almacén</th><th className={s.num}>En stock</th><th className={s.num}>Comprometido</th><th className={s.num}>Pedido</th><th className={s.num}>Disponible</th></tr></thead>
                    <tbody>
                      {wh.map((w: any) => (
                        <tr key={w.WarehouseCode}>
                          <td>{w.WarehouseCode}</td>
                          <td>{String(optLabel(whs.opts, w.WarehouseCode)).replace(`${w.WarehouseCode} - `, '')}</td>
                          <td className={s.num}>{qty(w.InStock)}</td>
                          <td className={s.num}>{qty(w.Committed)}</td>
                          <td className={s.num}>{qty(w.Ordered)}</td>
                          <td className={s.num}>{qty((w.InStock || 0) - (w.Committed || 0) + (w.Ordered || 0))}</td>
                        </tr>
                      ))}
                      {!wh.length && <tr><td colSpan={6} className={s.muted}>Sin stock en almacenes</td></tr>}
                      <tr style={{ fontWeight: 700 }}>
                        <td colSpan={2}>Total</td>
                        <td className={s.num}>{qty(tot.s)}</td><td className={s.num}>{qty(tot.c)}</td><td className={s.num}>{qty(tot.o)}</td><td className={s.num}>{qty(tot.s - tot.c + tot.o)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {tab === 'Precios' && (
              <table className={s.grid}>
                <thead><tr><th>Lista de precios</th><th className={s.num}>Precio</th><th>Moneda</th></tr></thead>
                <tbody>
                  {prices.map((p: any) => (
                    <tr key={p.PriceList}><td>{optLabel(pls.opts, p.PriceList)}</td><td className={s.num}>{fmtMoney(p.Price)}</td><td>{p.Currency}</td></tr>
                  ))}
                  {!prices.length && <tr><td colSpan={3} className={s.muted}>Sin precios</td></tr>}
                </tbody>
              </table>
            )}
            {tab === 'Datos generales' && (
              <div className={s.twoCols}>
                <div className={s.col}>
                  <Field label="UM inventario"><TextInput value={it.InventoryUOM} /></Field>
                  <Field label="UM ventas"><TextInput value={it.SalesUnit} /></Field>
                  <Field label="Grupo IVA ventas"><TextInput value={it.SalesVATGroup} /></Field>
                  <Field label="Fabricante"><TextInput value={it.Manufacturer} /></Field>
                </div>
                <div className={s.col}>
                  <Field label="Stock mínimo"><TextInput value={qty(it.MinInventory)} /></Field>
                  <Field label="Stock máximo"><TextInput value={qty(it.MaxInventory)} /></Field>
                  <Field label="Costo promedio"><TextInput value={fmtMoney(it.AvgStdPrice || it.MovingAveragePrice)} /></Field>
                  <Field label="Comentarios"><TextInput value={it.User_Text} /></Field>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={s.actions}>
        <button type="button" className={s.btnOk} onClick={onBack}>OK</button>
        <span className={s.spacer} />
        <span className={s.muted}>Solo lectura</span>
      </div>
    </Window>
  )
}
