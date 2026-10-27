// Controles de escritura hacia SAP (producción Firplak_SA).
import { NextRequest } from 'next/server';

/**
 * Modo simulación: si SAP_DRY_RUN=1 en el servidor o la petición trae `x-dry-run: 1`,
 * las rutas de escritura NO llaman a SAP y devuelven el payload que enviarían.
 */
export function isDryRun(request: NextRequest): boolean {
  if (process.env.SAP_DRY_RUN === '1') return true;
  // Interruptor maestro: sin SAP_WRITES_ENABLED=1 nunca se escribe en SAP (todo es simulación).
  if (process.env.SAP_WRITES_ENABLED !== '1') return true;
  const h = request.headers.get('x-dry-run');
  return h === '1' || h === 'true';
}

/**
 * Toda escritura real debe venir confirmada explícitamente desde el diálogo de la UI
 * (`x-sap-confirm: <acción>`). Evita escrituras accidentales por llamadas directas.
 */
export function hasWriteConfirmation(request: NextRequest): boolean {
  return Boolean(request.headers.get('x-sap-confirm'));
}

export interface WriteAudit {
  user: string | undefined;
  method: string;
  endpoint: string;
  dryRun: boolean;
}

export function logWrite(a: WriteAudit) {
  // Log de servidor (Vercel) con quién, qué y si fue simulación. No incluye el cuerpo.
  console.info(`[SAP-WRITE] ${a.dryRun ? 'DRY-RUN' : 'REAL'} ${a.method} ${a.endpoint} by ${a.user || 'unknown'}`);
}
