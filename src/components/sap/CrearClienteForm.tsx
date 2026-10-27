'use client'
// Formulario simple para crear un cliente. Envía POST /api/sap/m/clientes, que es SIMULADO
// (no crea nada en SAP) salvo que el servidor tenga SAP_WRITES_ENABLED=1.
import React, { useEffect, useMemo, useState } from 'react'
import f from './clienteForm.module.css'
import { apiGet, apiWrite, lookup, type Opt, type WriteResult } from './sapApi'
import {
  SALAS, emptyCliente, validarCliente, buildBusinessPartner, nombreCliente, cardCodeFor, nitDV,
  type ClienteForm, type Sala,
} from './clienteTemplate'

type Step = 'form' | 'confirm' | 'done'

export default function CrearClienteForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (code: string) => void }) {
  const [form, setForm] = useState<ClienteForm>(emptyCliente)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [step, setStep] = useState<Step>('form')
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [result, setResult] = useState<WriteResult | null>(null)
  const [simulated, setSimulated] = useState<boolean | null>(null)
  const [vendedores, setVendedores] = useState<Opt[]>([])
  const [municipios, setMunicipios] = useState<Opt[]>([])
  const [listas, setListas] = useState<Opt[]>([])
  const [grupos, setGrupos] = useState<Opt[]>([])
  const [ciudadText, setCiudadText] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(emptyCliente()); setErrors({}); setStep('form'); setApiError(null); setResult(null); setMore(false)
    setCiudadText(`${SALAS.MED.ciudad} (${SALAS.MED.municipio})`)
    apiGet('/api/sap/status').then(s => setSimulated(Boolean(s.dryRunForced))).catch(() => setSimulated(null))
    lookup('salespersons').then(o => setVendedores(o.filter(x => Number(x.value) > 0))).catch(() => {})
    lookup('udt', 'table=HBT_MUNICIPIO').then(setMunicipios).catch(() => {})
    lookup('pricelists').then(setListas).catch(() => {})
    lookup('bpgroups').then(setGrupos).catch(() => {})
  }, [open])

  const munOpts = useMemo(
    () => municipios.map(m => ({ code: String(m.value), name: m.label.replace(/^\d+\s*-\s*/, ''), text: `${m.label.replace(/^\d+\s*-\s*/, '')} (${m.value})` })),
    [municipios]
  )

  if (!open) return null

  const set = <K extends keyof ClienteForm>(k: K, v: ClienteForm[K]) => {
    setForm(p => ({ ...p, [k]: v }))
    if (errors[k as string]) setErrors(e => { const n = { ...e }; delete n[k as string]; return n })
  }

  const setSala = (s: Sala) => {
    const sala = SALAS[s]
    setForm(p => ({ ...p, sala: s, municipio: sala.municipio, ciudad: sala.ciudad }))
    setCiudadText(`${sala.ciudad} (${sala.municipio})`)
  }

  const onCiudad = (text: string) => {
    setCiudadText(text)
    const m = munOpts.find(o => o.text === text)
    setForm(p => ({ ...p, municipio: m ? m.code : '', ciudad: m ? m.name : '' }))
    if (m && errors.municipio) setErrors(e => { const n = { ...e }; delete n.municipio; return n })
  }

  const revisar = async () => {
    const e = validarCliente(form)
    setErrors(e)
    setApiError(null)
    if (Object.keys(e).length) return
    // Verificar (solo lectura) que el cliente no exista ya en SAP
    setBusy(true)
    try {
      const doc = form.documento.replace(/\D/g, '')
      const r = await apiGet(`/api/sap/lookups/bp?q=${encodeURIComponent(doc)}`)
      const dup = (r.rows || []).find((x: any) => x.CardCode === cardCodeFor(form) || String(x.FederalTaxID || '').split('-')[0] === doc)
      if (dup) {
        setErrors({ documento: `Ya existe en SAP: ${dup.CardCode} · ${dup.CardName}` })
        setBusy(false)
        return
      }
    } catch (err: any) {
      setApiError(`No se pudo verificar en SAP: ${err.message}`)
      setBusy(false)
      return
    }
    setBusy(false)
    setStep('confirm')
  }

  const crear = async () => {
    setBusy(true); setApiError(null)
    const payload = buildBusinessPartner(form)
    try {
      const r = await apiWrite('POST', '/api/sap/m/clientes', payload, { dryRun: false, confirm: `POST BusinessPartners ${payload.CardCode}` })
      if (!r.ok) setApiError(r.error || 'SAP rechazó la creación del cliente.')
      else { setResult(r); setStep('done'); if (!r.dryRun) onCreated?.(payload.CardCode) }
    } catch (err: any) {
      setApiError(err.message)
    }
    setBusy(false)
  }

  const err = (k: string) => (errors[k] ? <span className={f.error}>{errors[k]}</span> : null)
  const cls = (k: string, base = f.input) => `${base} ${errors[k] ? f.invalid : ''}`
  const natural = form.tipoPersona === 'natural'
  const doc = form.documento.replace(/\D/g, '')
  const vendedorName = vendedores.find(v => Number(v.value) === form.vendedor)?.label || ''

  return (
    <div className={f.overlay} role="dialog" aria-modal="true" id="crear-cliente-modal">
      <div className={f.card}>
        <div className={f.head}>
          <div>
            <h2 className={f.title}>{step === 'done' ? 'Cliente registrado' : step === 'confirm' ? 'Confirma los datos' : 'Nuevo cliente'}</h2>
            <p className={f.subtitle}>
              {step === 'form' && 'Solo lo esencial. El resto de la ficha de SAP se completa automáticamente.'}
              {step === 'confirm' && 'Revisa que todo esté correcto antes de crear el cliente.'}
            </p>
          </div>
          <button type="button" className={f.close} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {step === 'form' && (
          <>
            <div className={f.body}>
              {simulated !== false && (
                <div className={f.notice} id="crear-cliente-sim-notice">
                  <span>⚠️</span>
                  <span><b>Modo simulación.</b> El cliente no se creará en SAP; se mostrará lo que se enviaría.</span>
                </div>
              )}

              <div className={f.segment}>
                <button type="button" className={`${f.segBtn} ${natural ? f.segActive : ''}`} onClick={() => set('tipoPersona', 'natural')} id="tp-natural">Persona natural</button>
                <button type="button" className={`${f.segBtn} ${!natural ? f.segActive : ''}`} onClick={() => set('tipoPersona', 'juridica')} id="tp-juridica">Empresa (jurídica)</button>
              </div>

              <div className={f.row}>
                <div className={f.field}>
                  <label className={f.label} htmlFor="cc-doc">{natural ? 'Cédula' : 'NIT (sin dígito de verificación)'}</label>
                  <input id="cc-doc" inputMode="numeric" className={cls('documento')} value={form.documento} placeholder={natural ? 'Ej. 1020744733' : 'Ej. 900871788'}
                    onChange={e => set('documento', e.target.value)} />
                  {err('documento') || (!natural && /^\d{8,10}$/.test(doc) && <span className={f.hint}>DV: {nitDV(doc)} → {doc}-{nitDV(doc)}</span>)}
                </div>
                <div className={f.field}>
                  <label className={f.label} htmlFor="cc-sala">Tienda</label>
                  <select id="cc-sala" className={f.select} value={form.sala} onChange={e => setSala(e.target.value as Sala)}>
                    {(Object.keys(SALAS) as Sala[]).map(k => <option key={k} value={k}>{SALAS[k].label}</option>)}
                  </select>
                </div>
              </div>

              {natural ? (
                <div className={f.row3}>
                  <div className={f.field}>
                    <label className={f.label} htmlFor="cc-nombres">Nombres</label>
                    <input id="cc-nombres" className={cls('nombres')} value={form.nombres} onChange={e => set('nombres', e.target.value)} />
                    {err('nombres')}
                  </div>
                  <div className={f.field}>
                    <label className={f.label} htmlFor="cc-ap1">Primer apellido</label>
                    <input id="cc-ap1" className={cls('apellido1')} value={form.apellido1} onChange={e => set('apellido1', e.target.value)} />
                    {err('apellido1')}
                  </div>
                  <div className={f.field}>
                    <label className={f.label} htmlFor="cc-ap2">Segundo apellido <span className={f.opt}>(opcional)</span></label>
                    <input id="cc-ap2" className={f.input} value={form.apellido2} onChange={e => set('apellido2', e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className={f.field}>
                  <label className={f.label} htmlFor="cc-razon">Razón social</label>
                  <input id="cc-razon" className={cls('razonSocial')} value={form.razonSocial} placeholder="Ej. CONSTRUCTORA EJEMPLO S.A.S." onChange={e => set('razonSocial', e.target.value)} />
                  {err('razonSocial')}
                </div>
              )}

              <div className={f.row}>
                <div className={f.field}>
                  <label className={f.label} htmlFor="cc-tel">Teléfono / celular</label>
                  <input id="cc-tel" inputMode="tel" className={cls('telefono')} value={form.telefono} placeholder="Ej. 3001234567" onChange={e => set('telefono', e.target.value)} />
                  {err('telefono')}
                </div>
                <div className={f.field}>
                  <label className={f.label} htmlFor="cc-mail">Correo electrónico</label>
                  <input id="cc-mail" type="email" className={cls('correo')} value={form.correo} placeholder="cliente@correo.com" onChange={e => set('correo', e.target.value)} />
                  {err('correo') || <span className={f.hint}>Aquí llegará la factura electrónica.</span>}
                </div>
              </div>

              <div className={f.row}>
                <div className={f.field}>
                  <label className={f.label} htmlFor="cc-ciudad">Ciudad</label>
                  <input id="cc-ciudad" list="cc-municipios" className={cls('municipio')} value={ciudadText} placeholder="Escribe para buscar…" onChange={e => onCiudad(e.target.value)} />
                  <datalist id="cc-municipios">
                    {munOpts.map(m => <option key={m.code} value={m.text} />)}
                  </datalist>
                  {err('municipio')}
                </div>
                <div className={f.field}>
                  <label className={f.label} htmlFor="cc-dir">Dirección</label>
                  <input id="cc-dir" className={cls('direccion')} value={form.direccion} placeholder="Ej. CR 43A 18 SUR 135" onChange={e => set('direccion', e.target.value)} />
                  {err('direccion')}
                </div>
              </div>

              <div className={f.field}>
                <label className={f.label} htmlFor="cc-vend">Asesor comercial</label>
                <select id="cc-vend" className={cls('vendedor', f.select)} value={form.vendedor ?? ''} onChange={e => set('vendedor', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Selecciona…</option>
                  {vendedores.map(v => <option key={String(v.value)} value={v.value}>{v.label}</option>)}
                </select>
                {err('vendedor')}
              </div>

              <div className={f.more}>
                <button type="button" className={f.moreBtn} onClick={() => setMore(!more)} id="cc-mas-datos">
                  <span>Más datos <span className={f.opt}>(opcional)</span></span><span>{more ? '▲' : '▼'}</span>
                </button>
                {more && (
                  <div className={f.moreBody}>
                    <div className={f.row}>
                      <div className={f.field}>
                        <label className={f.label} htmlFor="cc-lista">Lista de precios</label>
                        <select id="cc-lista" className={f.select} value={form.listaPrecios} onChange={e => set('listaPrecios', Number(e.target.value))}>
                          {!listas.length && <option value={2}>2. Lista Canal Propio 2026</option>}
                          {listas.map(l => <option key={String(l.value)} value={l.value}>{l.label}</option>)}
                        </select>
                      </div>
                      <div className={f.field}>
                        <label className={f.label} htmlFor="cc-grupo">Grupo de cliente</label>
                        <select id="cc-grupo" className={f.select} value={form.grupo} onChange={e => set('grupo', Number(e.target.value))}>
                          {!grupos.length && <option value={113}>Canal B2C</option>}
                          {grupos.map(g => <option key={String(g.value)} value={g.value}>{g.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className={f.field}>
                      <label className={f.label} htmlFor="cc-act">Actividad económica (CIIU)</label>
                      <input id="cc-act" className={f.input} value={form.actividadEconomica} onChange={e => set('actividadEconomica', e.target.value)} />
                      <span className={f.hint}>0010 = asalariado / persona natural sin actividad.</span>
                    </div>
                    <div className={f.field}>
                      <label className={f.label} htmlFor="cc-com">Comentarios</label>
                      <textarea id="cc-com" className={f.textarea} value={form.comentarios} onChange={e => set('comentarios', e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              {apiError && <div className={f.apiError}>{apiError}</div>}
            </div>
            <div className={f.foot}>
              <button type="button" className={f.btnGhost} onClick={onClose}>Cancelar</button>
              <button type="button" className={f.btnPrimary} onClick={revisar} disabled={busy} id="cc-continuar">{busy ? 'Verificando…' : 'Continuar'}</button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className={f.body}>
              <div className={`${f.notice} ${simulated === false ? f.noticeReal : ''}`}>
                <span>{simulated === false ? '⛔' : '⚠️'}</span>
                <span>
                  {simulated === false
                    ? <><b>Se creará de verdad en SAP</b> (Firplak_SA). Verifica los datos.</>
                    : <><b>Modo simulación:</b> no se creará nada en SAP.</>}
                </span>
              </div>
              <dl className={f.summary} id="cc-resumen">
                <dt>Código SAP</dt><dd>{cardCodeFor(form)}</dd>
                <dt>Nombre</dt><dd>{nombreCliente(form)}</dd>
                <dt>{natural ? 'Cédula' : 'NIT'}</dt><dd>{natural ? doc : `${doc}-${nitDV(doc)}`}</dd>
                <dt>Teléfono</dt><dd>{form.telefono.replace(/\D/g, '')}</dd>
                <dt>Correo</dt><dd>{form.correo.trim().toLowerCase()}</dd>
                <dt>Ciudad</dt><dd>{form.ciudad}</dd>
                <dt>Dirección</dt><dd>{form.direccion.trim().toUpperCase()}</dd>
                <dt>Asesor</dt><dd>{vendedorName}</dd>
                <dt>Tienda</dt><dd>{SALAS[form.sala].label}</dd>
              </dl>
              {apiError && <div className={f.apiError}>{apiError}</div>}
            </div>
            <div className={f.foot}>
              <button type="button" className={f.btnGhost} onClick={() => setStep('form')} disabled={busy}>Volver a editar</button>
              <button type="button" className={f.btnPrimary} onClick={crear} disabled={busy} id="cc-crear">
                {busy ? 'Enviando…' : simulated === false ? 'Crear cliente en SAP' : 'Simular creación'}
              </button>
            </div>
          </>
        )}

        {step === 'done' && result && (
          <>
            <div className={f.body}>
              <div className={f.success} id="cc-resultado">
                <div className={`${f.successIcon} ${result.dryRun ? f.simIcon : ''}`}>{result.dryRun ? '🧪' : '✓'}</div>
                <h3 className={f.successTitle}>{result.dryRun ? 'Simulación exitosa' : '¡Cliente creado en SAP!'}</h3>
                <p className={f.subtitle}>
                  {result.dryRun
                    ? 'No se creó nada en SAP. Así quedaría el cliente:'
                    : 'El cliente ya está disponible en SAP Business One con el código:'}
                </p>
                <p><span className={f.code}>{result.data?.CardCode || cardCodeFor(form)}</span></p>
              </div>
              {result.dryRun && result.request && (
                <details className={f.details}>
                  <summary>Ver datos que se enviarían a SAP</summary>
                  <pre className={f.pre} id="cc-payload">{JSON.stringify(result.request.body, null, 2)}</pre>
                </details>
              )}
            </div>
            <div className={f.foot}>
              <button type="button" className={f.btnGhost} onClick={() => { setForm(emptyCliente()); setStep('form'); setResult(null) }}>Crear otro</button>
              <button type="button" className={f.btnPrimary} onClick={onClose}>Listo</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
