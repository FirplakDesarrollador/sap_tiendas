// Plantilla para crear un cliente (socio de negocio) con los valores que usan los clientes
// reales de Firplak Home (Canal B2C). Solo se piden los datos esenciales; el resto se deriva.

export type TipoPersona = 'natural' | 'juridica'
export type Sala = 'MED' | 'CAL' | 'BOG'

export interface ClienteForm {
  tipoPersona: TipoPersona
  documento: string // CC o NIT sin DV
  nombres: string // persona natural
  apellido1: string
  apellido2: string
  razonSocial: string // persona jurídica
  telefono: string
  correo: string
  municipio: string // código DANE (HBT_MUNICIPIO), ej. 05001
  ciudad: string // nombre del municipio
  direccion: string
  vendedor: number | null
  sala: Sala
  // "Más datos" (opcionales, con valores por defecto)
  actividadEconomica: string
  listaPrecios: number
  grupo: number
  comentarios: string
}

export const SALAS: Record<Sala, { label: string; property: number; costCenter: string; territory: number; municipio: string; ciudad: string }> = {
  MED: { label: 'Firplak Home Medellín', property: 6, costCenter: 'GV-FHMED', territory: 13, municipio: '05001', ciudad: 'MEDELLÍN' },
  CAL: { label: 'Firplak Home Cali', property: 7, costCenter: 'GV-FHCAL', territory: 15, municipio: '76001', ciudad: 'CALI' },
  BOG: { label: 'Firplak Home Bogotá', property: 8, costCenter: 'GV-FHBOG', territory: 8, municipio: '11001', ciudad: 'BOGOTÁ' },
}

export const emptyCliente = (): ClienteForm => ({
  tipoPersona: 'natural',
  documento: '',
  nombres: '',
  apellido1: '',
  apellido2: '',
  razonSocial: '',
  telefono: '',
  correo: '',
  municipio: SALAS.MED.municipio,
  ciudad: SALAS.MED.ciudad,
  direccion: '',
  vendedor: null,
  sala: 'MED',
  actividadEconomica: '0010',
  listaPrecios: 2,
  grupo: 113,
  comentarios: '',
})

/** Dígito de verificación DIAN para NIT */
export function nitDV(nit: string): number {
  const w = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]
  const d = nit.replace(/\D/g, '').split('').reverse()
  const sum = d.reduce((a, c, i) => a + Number(c) * w[i], 0)
  const r = sum % 11
  return r > 1 ? 11 - r : r
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const upper = (s: string) => clean(s).toUpperCase()

export function nombreCliente(f: ClienteForm): string {
  return f.tipoPersona === 'natural'
    ? upper(`${f.apellido1} ${f.apellido2} ${f.nombres}`)
    : upper(f.razonSocial)
}

export const cardCodeFor = (f: ClienteForm) => `CN${f.documento.replace(/\D/g, '')}-01`

/** Validación en español. Devuelve { campo: mensaje } */
export function validarCliente(f: ClienteForm): Record<string, string> {
  const e: Record<string, string> = {}
  const doc = f.documento.replace(/\D/g, '')
  if (!doc) e.documento = f.tipoPersona === 'natural' ? 'Ingresa la cédula.' : 'Ingresa el NIT.'
  else if (f.documento.replace(/[\s.]/g, '') !== doc) e.documento = 'Usa solo números (sin puntos, guiones ni dígito de verificación).'
  else if (f.tipoPersona === 'natural' && (doc.length < 5 || doc.length > 11)) e.documento = 'La cédula debe tener entre 5 y 11 dígitos.'
  else if (f.tipoPersona === 'juridica' && (doc.length < 8 || doc.length > 10)) e.documento = 'El NIT debe tener entre 8 y 10 dígitos (sin DV).'
  if (f.tipoPersona === 'natural') {
    if (!clean(f.nombres)) e.nombres = 'Ingresa el nombre.'
    if (!clean(f.apellido1)) e.apellido1 = 'Ingresa el primer apellido.'
  } else if (clean(f.razonSocial).length < 3) e.razonSocial = 'Ingresa la razón social.'
  if (nombreCliente(f).length > 100) e.razonSocial = 'El nombre no puede superar 100 caracteres.'
  const tel = f.telefono.replace(/\D/g, '')
  if (!tel) e.telefono = 'Ingresa un teléfono de contacto.'
  else if (tel.length < 7 || tel.length > 10) e.telefono = 'El teléfono debe tener entre 7 y 10 dígitos.'
  if (!clean(f.correo)) e.correo = 'Ingresa el correo (se usa para la factura electrónica).'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean(f.correo))) e.correo = 'El correo no es válido.'
  if (!/^\d{5}$/.test(f.municipio)) e.municipio = 'Selecciona la ciudad de la lista.'
  if (clean(f.direccion).length < 5) e.direccion = 'Ingresa la dirección.'
  else if (clean(f.direccion).length > 100) e.direccion = 'La dirección no puede superar 100 caracteres.'
  if (f.vendedor == null) e.vendedor = 'Selecciona el asesor comercial.'
  return e
}

/** Construye el payload de BusinessPartners para el Service Layer */
export function buildBusinessPartner(f: ClienteForm) {
  const doc = f.documento.replace(/\D/g, '')
  const natural = f.tipoPersona === 'natural'
  const name = nombreCliente(f)
  const code = cardCodeFor(f)
  const sala = SALAS[f.sala]
  const tel = f.telefono.replace(/\D/g, '')
  const correo = clean(f.correo).toLowerCase()
  const street = upper(f.direccion)
  const state = String(parseInt(f.municipio.slice(0, 2), 10))
  const addrName = name.slice(0, 50)
  const addr = (AddressName: string, AddressType: 'bo_BillTo' | 'bo_ShipTo', dirMM: 'Y' | 'N') => ({
    AddressName, AddressType, Street: street, City: f.ciudad, Country: 'CO', State: state, ZipCode: '000000',
    U_Telefono: tel, U_HBT_MunMed: f.municipio, U_HBT_DirMM: dirMM, U_EAN: code,
  })

  return {
    CardCode: code,
    CardName: name,
    CardType: 'cCustomer',
    GroupCode: f.grupo,
    FederalTaxID: natural ? doc : `${doc}-${nitDV(doc)}`,
    Currency: '$',
    PriceListNum: f.listaPrecios,
    PayTermsGrpCode: -1,
    SalesPersonCode: f.vendedor,
    Territory: sala.territory,
    Cellular: tel,
    EmailAddress: correo,
    City: f.ciudad,
    Country: 'CO',
    CompanyPrivate: 'cCompany',
    VatLiable: 'vLiable',
    SubjectToWithholdingTax: 'boYES',
    FreeText: clean(f.comentarios) || undefined,
    ContactPerson: addrName,
    BilltoDefault: 'Direccion MM',
    ShipToDefault: addrName,
    [`Properties${sala.property}`]: 'tYES',
    BPAddresses: [addr('Direccion MM', 'bo_BillTo', 'Y'), addr(addrName, 'bo_BillTo', 'N'), addr(addrName, 'bo_ShipTo', 'N')],
    ContactEmployees: [{ Name: addrName, Phone1: tel, E_Mail: correo }],
    BPWithholdingTaxCollection: (natural ? ['ACRE'] : ['ACRE', 'ARO2', 'ARS1', 'ARS2']).map(WTCode => ({ WTCode })),
    // Campos Firplak
    U_CentrodeCtos: sala.costCenter,
    U_SubGroupCode: '106-01',
    U_Certificaciones: 'NO',
    U_CamaraCcio: 'NO',
    U_CumplimientoPago: 'Bueno',
    U_Manejo: 'DIA',
    U_AutMayorista: 'NO',
    U_EsAutorret: 'N',
    U_EAN: code,
    U_IFRS_EXCDET: 'NO',
    U_GeneraAvisoDespacho: 'N',
    // Localización HBT (facturación electrónica)
    U_HBT_TipEnt: natural ? '1' : '2',
    U_HBT_TipDoc: natural ? '13' : '31',
    U_HBT_RegTrib: natural ? '02' : '01',
    U_HBT_RegFis: natural ? '49' : '48',
    U_HBT_ResFis: 'R-99-PN',
    U_HBT_Nombres: natural ? upper(f.nombres) : undefined,
    U_HBT_Apellido1: natural ? upper(f.apellido1) : undefined,
    U_HBT_Apellido2: natural && clean(f.apellido2) ? upper(f.apellido2) : undefined,
    U_HBT_MunMed: f.municipio,
    U_HBT_Nacional: '1',
    U_HBT_TipExt: '0',
    U_HBT_ActEco: clean(f.actividadEconomica) || '0010',
    U_HBT_MedPag: '30',
    U_HBT_ConsumFinal: 'N',
    U_HBT_MailRecep_FE: correo,
    U_HBT_Residente: 'SI',
    U_HBT_ConIVA: 'No',
    U_HBT_AplicaFel: 'N',
    U_HBT_EnviaXMLFE: 'N',
    U_HBT_DSA: 'N',
  }
}
