import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/sap/auth';
import { sapFetch } from '@/lib/sap/serviceLayer';
import { odataStr, getModule } from '@/lib/sap/modules';
import { errorResponse } from '@/lib/sap/write';

// Listas de valores (dropdowns) leídas del Service Layer. Todas son GET de solo lectura.
type Opt = { value: string | number; label: string; extra?: any };

const cache = new Map<string, { at: number; data: any }>();
const TTL = 10 * 60 * 1000;

/** Lee todas las páginas (hasta `max`) siguiendo odata.nextLink */
async function getAll(path: string, max = 2000): Promise<any[]> {
  const out: any[] = [];
  let next: string | null = path;
  while (next && out.length < max) {
    const res: any = await sapFetch(next, { maxPageSize: 500 });
    if (!res.ok) throw new Error(res.error);
    out.push(...(res.data?.value || []));
    const nl: string | undefined = res.data?.['odata.nextLink'];
    next = nl ? nl.replace(/^.*\/b1s\/v\d\//, '') : null;
  }
  return out;
}

function enc(s: string) {
  return encodeURIComponent(s);
}

const STATIC: Record<string, () => Promise<Opt[]>> = {
  salespersons: async () =>
    (await getAll(`SalesPersons?$select=SalesEmployeeCode,SalesEmployeeName,Active`))
      .filter(x => x.Active === 'tYES' && !/inactivo/i.test(x.SalesEmployeeName))
      .map(x => ({ value: x.SalesEmployeeCode, label: x.SalesEmployeeName })),
  territories: async () =>
    (await getAll(`Territories?$select=TerritoryID,Description,Inactive`))
      .filter(x => x.Inactive !== 'tYES')
      .map(x => ({ value: x.TerritoryID, label: x.Description })),
  pricelists: async () =>
    (await getAll(`PriceLists?$select=PriceListNo,PriceListName`))
      .sort((a, b) => a.PriceListNo - b.PriceListNo)
      .map(x => ({ value: x.PriceListNo, label: x.PriceListName })),
  paymentterms: async () =>
    (await getAll(`PaymentTermsTypes?$select=GroupNumber,PaymentTermsGroupName`))
      .map(x => ({ value: x.GroupNumber, label: x.PaymentTermsGroupName })),
  wtcodes: async () =>
    (await getAll(`WithholdingTaxCodes?$select=WTCode,WTName,Inactive`))
      .filter(x => x.Inactive !== 'tYES')
      .map(x => ({ value: x.WTCode, label: `${x.WTCode} - ${x.WTName}` })),
  bpgroups: async () =>
    (await getAll(`BusinessPartnerGroups?$select=Code,Name&$filter=${enc("Type eq 'bbpgt_CustomerGroup'")}`))
      .map(x => ({ value: x.Code, label: x.Name })),
  countries: async () =>
    (await getAll(`Countries?$select=Code,Name`)).map(x => ({ value: x.Code, label: x.Name })),
  warehouses: async () =>
    (await getAll(`Warehouses?$select=WarehouseCode,WarehouseName,Inactive`))
      .filter(x => x.Inactive !== 'tYES')
      .map(x => ({ value: x.WarehouseCode, label: `${x.WarehouseCode} - ${x.WarehouseName}` })),
  taxcodes: async () =>
    (await getAll(`SalesTaxCodes?$select=Code,Name,Rate,Inactive`))
      .filter(x => x.Inactive !== 'tYES')
      .map(x => ({ value: x.Code, label: `${x.Code} - ${x.Name}`, extra: { rate: x.Rate } })),
  costcenters: async () =>
    (await getAll(`ProfitCenters?$select=CenterCode,CenterName,Active,InWhichDimension`))
      .filter(x => x.Active === 'tYES' && x.InWhichDimension === 1)
      .map(x => ({ value: x.CenterCode, label: `${x.CenterCode} - ${x.CenterName}` })),
  properties: async () =>
    (await getAll(`BusinessPartnerProperties`))
      .filter(x => !/^Socios de negocios propiedad/i.test(x.PropertyName))
      .map(x => ({ value: x.PropertyCode, label: x.PropertyName })),
  itemgroups: async () =>
    (await getAll(`ItemGroups?$select=Number,GroupName`)).map(x => ({ value: x.Number, label: x.GroupName })),
};

export async function GET(request: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const { name } = await ctx.params;
  const sp = request.nextUrl.searchParams;

  try {
    if (STATIC[name]) {
      const hit = cache.get(name);
      if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ ok: true, options: hit.data });
      const data = await STATIC[name]();
      cache.set(name, { at: Date.now(), data });
      return NextResponse.json({ ok: true, options: data });
    }

    switch (name) {
      case 'states': {
        const country = (sp.get('country') || 'CO').slice(0, 3);
        const rows = await getAll(`States?$select=Code,Name&$filter=${enc(`Country eq ${odataStr(country)}`)}`);
        return NextResponse.json({ ok: true, options: rows.map(x => ({ value: x.Code, label: x.Name })) });
      }
      case 'udt': {
        // Tabla de usuario (UDT) vinculada a un campo: U_<TABLA>
        const table = sp.get('table') || '';
        if (!/^[A-Za-z0-9_]{1,30}$/.test(table)) return NextResponse.json({ ok: false, error: 'Tabla inválida' }, { status: 400 });
        const key = `udt:${table}`;
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ ok: true, options: hit.data });
        const rows = await getAll(`U_${table}?$select=Code,Name`, 3000);
        const data = rows.map(x => ({ value: x.Code, label: `${x.Code} - ${x.Name}` }));
        cache.set(key, { at: Date.now(), data });
        return NextResponse.json({ ok: true, options: data });
      }
      case 'udf': {
        // Metadatos de campos de usuario: descripción, tipo, valores válidos y tabla vinculada
        const table = sp.get('table') || '';
        if (!/^[A-Z0-9]{3,8}$/.test(table)) return NextResponse.json({ ok: false, error: 'Tabla inválida' }, { status: 400 });
        const key = `udf:${table}`;
        let all = cache.get(key)?.data as any[] | undefined;
        if (!all || Date.now() - (cache.get(key)?.at || 0) > TTL) {
          all = await getAll(
            `UserFieldsMD?$select=Name,Description,Type,SubType,Size,LinkedTable,DefaultValue,Mandatory,ValidValuesMD&$filter=${enc(`TableName eq ${odataStr(table)}`)}`
          );
          cache.set(key, { at: Date.now(), data: all });
        }
        const fields = (sp.get('fields') || '').split(',').map(s => s.trim().replace(/^U_/, '')).filter(Boolean);
        const sel = fields.length ? fields.map(f => all!.find(x => x.Name === f)).filter(Boolean) : all;
        return NextResponse.json({
          ok: true,
          fields: sel.map((f: any) => ({
            name: `U_${f.Name}`,
            label: f.Description,
            type: f.Type,
            subType: f.SubType,
            size: f.Size,
            linkedTable: f.LinkedTable || null,
            defaultValue: f.DefaultValue ?? null,
            mandatory: f.Mandatory === 'tYES',
            validValues: (f.ValidValuesMD || []).filter((v: any) => v.Value != null).map((v: any) => ({ value: v.Value, label: v.Description || v.Value })),
          })),
        });
      }
      case 'bp': {
        // Búsqueda de clientes (Ctrl+Tab en SAP)
        const q = (sp.get('q') || '').trim();
        const f = [`CardType eq 'cCustomer'`];
        if (q) f.push(`(contains(CardCode,${odataStr(q)}) or contains(CardName,${odataStr(q)}) or contains(FederalTaxID,${odataStr(q)}))`);
        const res = await sapFetch(
          `BusinessPartners?$select=CardCode,CardName,FederalTaxID,PriceListNum,SalesPersonCode,PayTermsGrpCode,Currency&$filter=${enc(f.join(' and '))}&$top=20`,
          { maxPageSize: 20 }
        );
        if (!res.ok) throw new Error(res.error);
        return NextResponse.json({ ok: true, rows: res.data?.value || [] });
      }
      case 'bpdetail': {
        const card = sp.get('cardCode') || '';
        if (!card) return NextResponse.json({ ok: false, error: 'cardCode requerido' }, { status: 400 });
        const res = await sapFetch(
          `BusinessPartners(${enc(odataStr(card))})?$select=CardCode,CardName,FederalTaxID,PriceListNum,SalesPersonCode,PayTermsGrpCode,Currency,ContactPerson,BilltoDefault,ShipToDefault,CurrentAccountBalance,ContactEmployees,BPAddresses,U_CentrodeCtos`
        );
        if (!res.ok) throw new Error(res.error);
        return NextResponse.json({ ok: true, data: res.data });
      }
      case 'items': {
        const q = (sp.get('q') || '').trim();
        const f = [`SalesItem eq 'tYES'`, `Valid eq 'tYES'`];
        if (q) f.push(`(contains(ItemCode,${odataStr(q)}) or contains(ItemName,${odataStr(q)}))`);
        const res = await sapFetch(
          `Items?$select=ItemCode,ItemName,QuantityOnStock,SalesUnit,InventoryUOM&$filter=${enc(f.join(' and '))}&$top=20`,
          { maxPageSize: 20 }
        );
        if (!res.ok) throw new Error(res.error);
        return NextResponse.json({ ok: true, rows: res.data?.value || [] });
      }
      case 'item': {
        // Precio según lista del cliente, almacén por defecto y stock
        const code = sp.get('code') || '';
        const pl = parseInt(sp.get('priceList') || '0', 10);
        const res = await sapFetch(
          `Items(${enc(odataStr(code))})?$select=ItemCode,ItemName,DefaultWarehouse,SalesVATGroup,QuantityOnStock,ItemPrices,ItemWarehouseInfoCollection,SalesUnit,InventoryUOM`
        );
        if (!res.ok) throw new Error(res.error);
        const d = res.data;
        const price = (d.ItemPrices || []).find((p: any) => p.PriceList === pl);
        return NextResponse.json({
          ok: true,
          data: {
            ItemCode: d.ItemCode,
            ItemName: d.ItemName,
            DefaultWarehouse: d.DefaultWarehouse,
            SalesVATGroup: d.SalesVATGroup,
            QuantityOnStock: d.QuantityOnStock,
            Price: price?.Price ?? 0,
            Unit: d.SalesUnit || d.InventoryUOM,
            Warehouses: (d.ItemWarehouseInfoCollection || [])
              .filter((w: any) => w.InStock || w.Committed || w.Ordered)
              .map((w: any) => ({ code: w.WarehouseCode, inStock: w.InStock, committed: w.Committed, ordered: w.Ordered })),
          },
        });
      }
      case 'opendocs': {
        // Documentos abiertos de un cliente para "Copiar desde"
        const mod = getModule(sp.get('module') || '');
        const card = sp.get('cardCode') || '';
        if (!mod || !mod.doc || !card) return NextResponse.json({ ok: false, error: 'module/cardCode requeridos' }, { status: 400 });
        const res = await sapFetch(
          `${mod.entity}?$select=DocEntry,DocNum,DocDate,DocDueDate,DocTotal,NumAtCard,Comments,DocumentLines&$filter=${enc(
            `CardCode eq ${odataStr(card)} and DocumentStatus eq 'bost_Open' and Cancelled eq 'tNO'`
          )}&$orderby=DocEntry desc&$top=20`,
          { maxPageSize: 20 }
        );
        if (!res.ok) throw new Error(res.error);
        const rows = (res.data?.value || []).map((d: any) => ({
          ...d,
          DocumentLines: (d.DocumentLines || [])
            .filter((l: any) => l.LineStatus === 'bost_Open')
            .map((l: any) => ({
              LineNum: l.LineNum, ItemCode: l.ItemCode, ItemDescription: l.ItemDescription,
              Quantity: l.Quantity, RemainingOpenQuantity: l.RemainingOpenQuantity, UnitPrice: l.UnitPrice,
              Price: l.Price, DiscountPercent: l.DiscountPercent, TaxCode: l.TaxCode, WarehouseCode: l.WarehouseCode,
              CostingCode: l.CostingCode, TaxPercentagePerRow: l.TaxPercentagePerRow, SalesPersonCode: l.SalesPersonCode,
            })),
        }));
        return NextResponse.json({ ok: true, rows });
      }
      case 'openinvoices': {
        const card = sp.get('cardCode') || '';
        if (!card) return NextResponse.json({ ok: false, error: 'cardCode requerido' }, { status: 400 });
        const res = await sapFetch(
          `Invoices?$select=DocEntry,DocNum,DocDate,DocDueDate,DocTotal,PaidToDate,NumAtCard&$filter=${enc(
            `CardCode eq ${odataStr(card)} and DocumentStatus eq 'bost_Open' and Cancelled eq 'tNO'`
          )}&$orderby=DocDueDate&$top=50`,
          { maxPageSize: 50 }
        );
        if (!res.ok) throw new Error(res.error);
        return NextResponse.json({ ok: true, rows: res.data?.value || [] });
      }
      case 'accounts': {
        const q = (sp.get('q') || '').trim();
        const f = [`ActiveAccount eq 'tYES'`];
        if (q) f.push(/^\d+$/.test(q) ? `startswith(Code,${odataStr(q)})` : `contains(Name,${odataStr(q)})`);
        const res = await sapFetch(`ChartOfAccounts?$select=Code,Name&$filter=${enc(f.join(' and '))}&$top=30&$orderby=Code`, { maxPageSize: 30 });
        if (!res.ok) throw new Error(res.error);
        return NextResponse.json({ ok: true, options: (res.data?.value || []).map((x: any) => ({ value: x.Code, label: `${x.Code} - ${x.Name}` })) });
      }
      case 'series': {
        // Series usadas recientemente en el módulo (el SL solo expone SeriesService por POST)
        const mod = getModule(sp.get('module') || '');
        if (!mod || mod.key === 'clientes' || mod.key === 'inventario') return NextResponse.json({ ok: false, error: 'module inválido' }, { status: 400 });
        const res = await sapFetch(`${mod.entity}?$select=Series,DocNum&$orderby=DocEntry desc&$top=300`, { maxPageSize: 300 });
        if (!res.ok) throw new Error(res.error);
        const map = new Map<number, { count: number; last: number }>();
        for (const r of res.data?.value || []) {
          const m = map.get(r.Series) || { count: 0, last: r.DocNum };
          m.count++;
          map.set(r.Series, m);
        }
        const options = [...map.entries()]
          .sort((a, b) => b[1].count - a[1].count)
          .map(([s, m]) => ({ value: s, label: `Serie ${s} (último Nº ${m.last})`, extra: { nextNum: m.last + 1 } }));
        return NextResponse.json({ ok: true, options });
      }
      default:
        return NextResponse.json({ ok: false, error: `Lista desconocida: ${name}` }, { status: 404 });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
