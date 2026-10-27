// Registro de módulos SAP expuestos por /api/sap/m/[module]
// Define, por módulo, la entidad del Service Layer y qué operaciones permite SL.

export type SapModuleKey = 'clientes' | 'ofertas' | 'entregas' | 'facturas' | 'pagos' | 'inventario';

export interface SapModuleDef {
  key: SapModuleKey;
  entity: string; // EntitySet del Service Layer
  keyType: 'string' | 'number';
  keyField: string;
  listSelect: string[];
  baseFilter?: string;
  orderBy: string;
  create: boolean;
  update: boolean;
  remove: boolean; // DELETE real (solo donde SL lo permite)
  actions: string[]; // Acciones POST /Entity(key)/Action
  doc: boolean; // documento de marketing
}

const DOC_SELECT = [
  'DocEntry', 'DocNum', 'Series', 'DocDate', 'DocDueDate', 'CardCode', 'CardName', 'NumAtCard',
  'DocTotal', 'VatSum', 'DocumentStatus', 'Cancelled', 'SalesPersonCode', 'Comments',
];

export const SAP_MODULES: Record<SapModuleKey, SapModuleDef> = {
  clientes: {
    key: 'clientes',
    entity: 'BusinessPartners',
    keyType: 'string',
    keyField: 'CardCode',
    listSelect: ['CardCode', 'CardName', 'FederalTaxID', 'GroupCode', 'SalesPersonCode', 'Phone1', 'Cellular',
      'EmailAddress', 'City', 'Valid', 'CurrentAccountBalance', 'PriceListNum', 'CreateDate', 'Properties6'],
    baseFilter: "CardType eq 'cCustomer'",
    orderBy: 'CreateDate desc,CardCode desc',
    create: true,
    update: true,
    remove: true, // SL permite DELETE de socios sin transacciones
    actions: [],
    doc: false,
  },
  ofertas: {
    key: 'ofertas', entity: 'Quotations', keyType: 'number', keyField: 'DocEntry',
    listSelect: DOC_SELECT, orderBy: 'DocEntry desc',
    create: true, update: true, remove: false, actions: ['Cancel', 'Close', 'Reopen'], doc: true,
  },
  entregas: {
    key: 'entregas', entity: 'DeliveryNotes', keyType: 'number', keyField: 'DocEntry',
    listSelect: DOC_SELECT, orderBy: 'DocEntry desc',
    create: true, update: true, remove: false, actions: ['Cancel', 'Close', 'Reopen'], doc: true,
  },
  facturas: {
    key: 'facturas', entity: 'Invoices', keyType: 'number', keyField: 'DocEntry',
    listSelect: [...DOC_SELECT, 'PaidToDate'], orderBy: 'DocEntry desc',
    create: true, update: true, remove: false, actions: ['Cancel', 'Close'], doc: true,
  },
  pagos: {
    key: 'pagos', entity: 'IncomingPayments', keyType: 'number', keyField: 'DocEntry',
    listSelect: ['DocEntry', 'DocNum', 'Series', 'DocDate', 'CardCode', 'CardName', 'TransferSum', 'CashSum',
      'CheckAccount', 'Cancelled', 'Remarks', 'CounterReference', 'U_TipoRC', 'U_asesor'],
    orderBy: 'DocEntry desc',
    create: true, update: true, remove: false, actions: ['Cancel'], doc: false,
  },
  inventario: {
    key: 'inventario', entity: 'Items', keyType: 'string', keyField: 'ItemCode',
    listSelect: ['ItemCode', 'ItemName', 'ItemsGroupCode', 'QuantityOnStock', 'QuantityOrderedFromVendors',
      'QuantityOrderedByCustomers', 'InventoryUOM', 'Valid', 'SalesItem', 'InventoryItem'],
    orderBy: 'ItemCode',
    create: false, update: false, remove: false, actions: [], doc: false,
  },
};

export function getModule(key: string): SapModuleDef | null {
  return (SAP_MODULES as Record<string, SapModuleDef>)[key] || null;
}

/** Literal OData con comillas escapadas */
export function odataStr(v: string): string {
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Ruta del registro: Entity('X') o Entity(123). Devuelve null si la llave es inválida. */
export function entityPath(mod: SapModuleDef, id: string): string | null {
  if (mod.keyType === 'number') {
    if (!/^\d+$/.test(id)) return null;
    return `${mod.entity}(${id})`;
  }
  if (!id || id.length > 50) return null;
  return `${mod.entity}(${encodeURIComponent(odataStr(id))})`;
}

export function isoDate(v: string | null): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

/** Construye el $filter de la lista a partir de los parámetros de búsqueda */
export function buildListFilter(mod: SapModuleDef, sp: URLSearchParams): string {
  const parts: string[] = [];
  if (mod.baseFilter) parts.push(mod.baseFilter);
  const q = (sp.get('q') || '').trim();

  if (mod.key === 'clientes') {
    if (q) parts.push(`(contains(CardCode,${odataStr(q)}) or contains(CardName,${odataStr(q)}) or contains(FederalTaxID,${odataStr(q)}))`);
    const prop = sp.get('property');
    if (prop && /^\d{1,2}$/.test(prop)) parts.push(`Properties${prop} eq 'tYES'`);
    const group = sp.get('group');
    if (group && /^-?\d+$/.test(group)) parts.push(`GroupCode eq ${group}`);
  } else if (mod.key === 'inventario') {
    if (q) parts.push(`(contains(ItemCode,${odataStr(q)}) or contains(ItemName,${odataStr(q)}))`);
    const group = sp.get('group');
    if (group && /^\d+$/.test(group)) parts.push(`ItemsGroupCode eq ${group}`);
    if (sp.get('withStock') === '1') parts.push('QuantityOnStock gt 0');
    const from = sp.get('codeFrom');
    const to = sp.get('codeTo');
    if (from) parts.push(`ItemCode ge ${odataStr(from)}`);
    if (to) parts.push(`ItemCode le ${odataStr(to)}`);
  } else {
    if (q) {
      if (/^\d+$/.test(q)) parts.push(`DocNum eq ${q}`);
      else parts.push(`(contains(CardName,${odataStr(q)}) or contains(CardCode,${odataStr(q)}))`);
    }
    const card = sp.get('cardCode');
    if (card) parts.push(`CardCode eq ${odataStr(card)}`);
    const status = sp.get('status');
    if (mod.doc) {
      if (status === 'open') parts.push("DocumentStatus eq 'bost_Open' and Cancelled eq 'tNO'");
      if (status === 'closed') parts.push("DocumentStatus eq 'bost_Close' and Cancelled eq 'tNO'");
      if (status === 'cancelled') parts.push("Cancelled eq 'tYES'");
    } else if (mod.key === 'pagos') {
      if (status === 'open') parts.push("Cancelled eq 'tNO'");
      if (status === 'cancelled') parts.push("Cancelled eq 'tYES'");
    }
    const from = isoDate(sp.get('from'));
    const to = isoDate(sp.get('to'));
    if (from) parts.push(`DocDate ge '${from}'`);
    if (to) parts.push(`DocDate le '${to}'`);
    const slp = sp.get('salesPerson');
    if (slp && /^-?\d+$/.test(slp) && mod.doc) parts.push(`SalesPersonCode eq ${slp}`);
  }
  return parts.join(' and ');
}

/** Limpia un payload antes de enviarlo a SAP: quita metadatos OData y campos de solo lectura */
const READ_ONLY_KEYS = new Set([
  'odata.metadata', 'odata.etag', 'DocNum', 'CreateDate', 'CreateTime', 'UpdateDate', 'UpdateTime',
  'CreationDate', 'DocTotalSys', 'VatSumSys', 'DataVersion', 'CurrentAccountBalance', 'OpenDeliveryNotesBalance',
  'OpenOrdersBalance', 'OpenChecksBalance', 'DocumentStatus', 'Cancelled', 'PaidToDate', 'VatSum',
]);

export function cleanPayload(input: any, isCreate: boolean, mod: SapModuleDef): any {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k.startsWith('odata.') || k.startsWith('_')) continue;
    if (READ_ONLY_KEYS.has(k)) continue;
    if (isCreate && mod.keyType === 'number' && k === mod.keyField) continue;
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      out[k] = v.map(row => {
        if (!row || typeof row !== 'object') return row;
        const r: Record<string, any> = {};
        for (const [rk, rv] of Object.entries(row)) {
          if (rk.startsWith('odata.') || rk.startsWith('_') || rv === undefined) continue;
          r[rk] = rv;
        }
        return r;
      });
    } else {
      out[k] = v;
    }
  }
  return out;
}
