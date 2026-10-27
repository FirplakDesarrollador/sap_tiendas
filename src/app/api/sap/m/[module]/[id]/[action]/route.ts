import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/sap/auth';
import { getModule, entityPath } from '@/lib/sap/modules';
import { performWrite, errorResponse } from '@/lib/sap/write';

// POST /api/sap/m/:module/:id/:action  → Cancel | Close | Reopen (acciones de documento del SL)
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ module: string; id: string; action: string }> }
) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const { module, id, action } = await ctx.params;
  const mod = getModule(module);
  if (!mod) return NextResponse.json({ ok: false, error: 'Módulo desconocido' }, { status: 404 });
  const act = mod.actions.find(a => a.toLowerCase() === action.toLowerCase());
  if (!act) return NextResponse.json({ ok: false, error: `Acción no permitida: ${action}` }, { status: 405 });
  const path = entityPath(mod, decodeURIComponent(id));
  if (!path) return NextResponse.json({ ok: false, error: 'Llave inválida' }, { status: 400 });
  try {
    return await performWrite(request, user, 'POST', `${path}/${act}`);
  } catch (e) {
    return errorResponse(e);
  }
}
