// Ejecuta (o simula) una escritura hacia el Service Layer con los controles del portal.
import { NextRequest, NextResponse } from 'next/server';
import { sapFetch, getSapConfig } from './serviceLayer';
import { isDryRun, hasWriteConfirmation, logWrite } from './guard';
import type { ApiUser } from './auth';

export async function performWrite(
  request: NextRequest,
  user: ApiUser,
  method: 'POST' | 'PATCH' | 'DELETE',
  endpoint: string,
  body?: unknown,
  headers?: Record<string, string>
) {
  const dryRun = isDryRun(request);
  logWrite({ user: user.email || user.id, method, endpoint, dryRun });

  if (dryRun) {
    let companyDB = '(sin configurar)';
    try {
      companyDB = getSapConfig().companyDB;
    } catch {}
    return NextResponse.json({
      ok: true,
      dryRun: true,
      message: 'Simulación: no se envió nada a SAP.',
      request: { method, endpoint, companyDB, headers: headers || {}, body: body ?? null },
    });
  }

  if (!hasWriteConfirmation(request)) {
    return NextResponse.json(
      { ok: false, error: 'Falta la confirmación explícita (x-sap-confirm) para escribir en SAP.' },
      { status: 428 }
    );
  }

  const res = await sapFetch(endpoint, { method, body, headers });
  if (!res.ok) {
    return NextResponse.json({ ok: false, status: res.status, error: res.error }, { status: res.status >= 400 ? res.status : 502 });
  }
  return NextResponse.json({ ok: true, dryRun: false, status: res.status, data: res.data ?? null });
}

export function errorResponse(e: any, status = 500) {
  return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status });
}
