import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/sap/auth';
import { sapFetch } from '@/lib/sap/serviceLayer';
import { getModule, entityPath, cleanPayload } from '@/lib/sap/modules';
import { performWrite, errorResponse } from '@/lib/sap/write';

type Ctx = { params: Promise<{ module: string; id: string }> };

async function resolve(request: NextRequest, ctx: Ctx) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return { error: user } as const;
  const { module, id } = await ctx.params;
  const mod = getModule(module);
  if (!mod) return { error: NextResponse.json({ ok: false, error: 'Módulo desconocido' }, { status: 404 }) } as const;
  const path = entityPath(mod, decodeURIComponent(id));
  if (!path) return { error: NextResponse.json({ ok: false, error: 'Llave inválida' }, { status: 400 }) } as const;
  return { user, mod, path } as const;
}

// GET detalle
export async function GET(request: NextRequest, ctx: Ctx) {
  const r = await resolve(request, ctx);
  if ('error' in r) return r.error;
  try {
    const res = await sapFetch(r.path);
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true, data: res.data });
  } catch (e) {
    return errorResponse(e);
  }
}

// PATCH actualizar (Actualizar). El Service Layer usa PATCH para actualizar.
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const r = await resolve(request, ctx);
  if ('error' in r) return r.error;
  if (!r.mod.update) return NextResponse.json({ ok: false, error: 'Este módulo no permite actualizar' }, { status: 405 });
  try {
    const raw = await request.json();
    const replace = Boolean(raw?._replaceCollections);
    const body = cleanPayload(raw, false, r.mod);
    delete body[r.mod.keyField];
    return await performWrite(request, r.user, 'PATCH', r.path, body,
      replace ? { 'B1S-ReplaceCollectionsOnPatch': 'true' } : undefined);
  } catch (e) {
    return errorResponse(e);
  }
}

// PUT se mapea a PATCH (SL no reemplaza entidades completas por PUT en este flujo)
export const PUT = PATCH;

// DELETE (solo donde SL lo permite: Socios de negocio)
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const r = await resolve(request, ctx);
  if ('error' in r) return r.error;
  if (!r.mod.remove) {
    return NextResponse.json(
      { ok: false, error: 'SAP no permite borrar este documento. Usa Cancelar o Cerrar.' },
      { status: 405 }
    );
  }
  try {
    return await performWrite(request, r.user, 'DELETE', r.path);
  } catch (e) {
    return errorResponse(e);
  }
}
