import { NextRequest, NextResponse } from 'next/server';
import { getSapOrders, getSapItems, getSapBusinessPartners } from '@/lib/sap/serviceLayer';
import { requireUser } from '@/lib/sap/auth';

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const { searchParams } = new URL(request.url);
  const entity = searchParams.get('entity') || 'orders';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10) || 10, 1), 50);

  try {
    if (entity === 'orders') {
      const res = await getSapOrders(limit);
      const orders = res.data?.value || [];
      const formatted = orders.map((o: any) => ({
        col1: `OV-SAP-${o.DocNum}`,
        col2: o.CardName || o.CardCode || 'Sin Cliente',
        col3: `$${Number(o.DocTotal || 0).toLocaleString('es-CO')}`,
        col4: o.DocumentStatus === 'bost_Open' ? 'Abierta' : 'Cerrada / Sincronizada',
        raw: o,
      }));
      return NextResponse.json({ ok: true, entity, count: orders.length, rows: formatted });
    }

    if (entity === 'items') {
      const res = await getSapItems(limit);
      const items = res.data?.value || [];
      const formatted = items.map((i: any) => ({
        col1: i.ItemCode,
        col2: i.ItemName || 'Sin descripción',
        col3: i.ItemsGroupCode ? `Grupo ${i.ItemsGroupCode}` : 'Catálogo SAP',
        col4: i.Valid === 'tYES' ? 'Activo' : 'Inactivo',
        raw: i,
      }));
      return NextResponse.json({ ok: true, entity, count: items.length, rows: formatted });
    }

    if (entity === 'clients' || entity === 'businesspartners') {
      const res = await getSapBusinessPartners(limit);
      const bps = res.data?.value || [];
      const formatted = bps.map((b: any) => ({
        col1: b.CardCode,
        col2: b.CardName || 'Sin Nombre',
        col3: b.CardType === 'cCustomer' ? 'Cliente' : 'Proveedor',
        col4: b.Valid === 'tYES' ? 'Activo' : 'Inactivo',
        raw: b,
      }));
      return NextResponse.json({ ok: true, entity, count: bps.length, rows: formatted });
    }

    return NextResponse.json({ ok: false, error: `Entidad desconocida: ${entity}` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al consultar SAP Service Layer' },
      { status: 500 }
    );
  }
}
