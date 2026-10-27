import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/sap/auth';
import { sapFetch } from '@/lib/sap/serviceLayer';
import { getModule, buildListFilter, cleanPayload } from '@/lib/sap/modules';
import { performWrite, errorResponse } from '@/lib/sap/write';

// GET /api/sap/m/:module?q=&status=&from=&to=&top=&skip=  → lista con filtros y paginación
export async function GET(request: NextRequest, ctx: { params: Promise<{ module: string }> }) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const { module } = await ctx.params;
  const mod = getModule(module);
  if (!mod) return NextResponse.json({ ok: false, error: 'Módulo desconocido' }, { status: 404 });

  const sp = request.nextUrl.searchParams;
  const top = Math.min(Math.max(parseInt(sp.get('top') || '20', 10) || 20, 1), 100);
  const skip = Math.max(parseInt(sp.get('skip') || '0', 10) || 0, 0);
  const filter = buildListFilter(mod, sp);

  const qs = new URLSearchParams();
  qs.set('$select', mod.listSelect.join(','));
  if (filter) qs.set('$filter', filter);
  qs.set('$orderby', mod.orderBy);
  qs.set('$top', String(top));
  if (skip) qs.set('$skip', String(skip));

  try {
    const res = await sapFetch(`${mod.entity}?${qs.toString().replace(/\+/g, '%20')}`, { maxPageSize: top });
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
    const rows = res.data?.value || [];
    return NextResponse.json({ ok: true, module: mod.key, rows, top, skip, hasMore: rows.length === top });
  } catch (e) {
    return errorResponse(e);
  }
}

// POST /api/sap/m/:module → crear (Agregar)
export async function POST(request: NextRequest, ctx: { params: Promise<{ module: string }> }) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const { module } = await ctx.params;
  const mod = getModule(module);
  if (!mod || !mod.create) return NextResponse.json({ ok: false, error: 'Este módulo no permite crear registros' }, { status: 405 });
  try {
    const body = cleanPayload(await request.json(), true, mod);
    return await performWrite(request, user, 'POST', mod.entity, body);
  } catch (e) {
    return errorResponse(e);
  }
}
