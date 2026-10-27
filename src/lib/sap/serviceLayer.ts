// Cliente de integración con SAP Business One Service Layer
// Firplak S.A. — SOLO servidor. Las credenciales se leen exclusivamente de
// variables de entorno (nunca deben quedar escritas en el código: el repo es público).

interface SapSessionState {
  cookieHeader: string | null;
  sessionId: string | null;
  version: string | null;
  expiresAt: number | null;
}

const sessionCache: SapSessionState = {
  cookieHeader: null,
  sessionId: null,
  version: null,
  expiresAt: null,
};

let loginInFlight: Promise<{ cookieHeader: string; sessionId: string; version: string }> | null = null;

// El Service Layer corporativo usa un certificado autofirmado.
if (typeof process !== 'undefined' && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export class SapConfigError extends Error {}

export function getSapConfig() {
  const baseUrl = process.env.SAP_BASE_URL;
  const companyDB = process.env.SAP_COMPANY_DB;
  const userName = process.env.SAP_USERNAME;
  const password = process.env.SAP_PASSWORD;

  const missing = [
    !baseUrl && 'SAP_BASE_URL',
    !companyDB && 'SAP_COMPANY_DB',
    !userName && 'SAP_USERNAME',
    !password && 'SAP_PASSWORD',
  ].filter(Boolean);

  if (missing.length) {
    throw new SapConfigError(
      `Configuración de SAP incompleta: faltan las variables de entorno ${missing.join(', ')}.`
    );
  }

  return {
    baseUrl: baseUrl!.replace(/\/$/, ''),
    companyDB: companyDB!,
    userName: userName!,
    password: password!,
  };
}

function extractCookies(response: Response): string {
  let rawCookies: string[] = [];
  const h = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') {
    rawCookies = h.getSetCookie();
  } else {
    const cookieHeader = response.headers.get('set-cookie');
    if (cookieHeader) rawCookies = cookieHeader.split(/,(?=\s*[A-Za-z0-9_-]+=)/);
  }
  return rawCookies.map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
}

/**
 * Autenticación contra el endpoint /Login de SAP Service Layer.
 * Se deduplica para que peticiones concurrentes compartan un solo login.
 */
export async function loginToSap(): Promise<{ cookieHeader: string; sessionId: string; version: string }> {
  if (loginInFlight) return loginInFlight;

  loginInFlight = (async () => {
    const config = getSapConfig();
    const response = await fetch(`${config.baseUrl}/Login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        CompanyDB: config.companyDB,
        UserName: config.userName,
        Password: config.password,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      let msg = errorText;
      try {
        msg = JSON.parse(errorText)?.error?.message?.value || errorText;
      } catch {}
      throw new Error(`Error de autenticación SAP Service Layer (${response.status}): ${msg}`);
    }

    const cookieHeader = extractCookies(response);
    const data = await response.json();
    const sessionId = data.SessionId || '';
    const version = data.Version || '';
    const timeoutMin = Number(data.SessionTimeout) || 30;

    sessionCache.cookieHeader = cookieHeader;
    sessionCache.sessionId = sessionId;
    sessionCache.version = version;
    sessionCache.expiresAt = Date.now() + Math.max(5, timeoutMin - 5) * 60 * 1000;

    return { cookieHeader, sessionId, version };
  })();

  try {
    return await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}

/**
 * Obtener sesión activa válida (reutiliza o autentica si expiró)
 */
export async function getValidSapSession(): Promise<{ cookieHeader: string; sessionId: string; version: string }> {
  if (sessionCache.cookieHeader && sessionCache.expiresAt && Date.now() < sessionCache.expiresAt) {
    return {
      cookieHeader: sessionCache.cookieHeader,
      sessionId: sessionCache.sessionId || '',
      version: sessionCache.version || '',
    };
  }
  return await loginToSap();
}

export interface SapFetchOptions {
  method?: string;
  body?: unknown;
  maxPageSize?: number;
  headers?: Record<string, string>;
}

export interface SapResponse<T = any> {
  status: number;
  ok: boolean;
  data: T;
  error?: string;
}

/** Extrae el mensaje legible de un error OData del Service Layer */
export function sapErrorMessage(data: any, status: number): string {
  if (!data) return `SAP respondió ${status}`;
  if (typeof data === 'string') return data.slice(0, 500) || `SAP respondió ${status}`;
  const m = data?.error?.message;
  if (typeof m === 'string') return m;
  return m?.value || data?.error?.code?.toString() || `SAP respondió ${status}`;
}

/**
 * Petición genérica al SAP Service Layer con reintento automático si expira la sesión
 */
export async function sapFetch<T = any>(endpoint: string, options: SapFetchOptions = {}): Promise<SapResponse<T>> {
  const config = getSapConfig();
  const url = endpoint.startsWith('http') ? endpoint : `${config.baseUrl}/${endpoint.replace(/^\//, '')}`;

  let session = await getValidSapSession();

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Cookie: session.cookieHeader,
    ...(options.headers || {}),
  };
  if (options.maxPageSize) reqHeaders['Prefer'] = `odata.maxpagesize=${options.maxPageSize}`;

  const doFetch = () =>
    fetch(url, {
      method: options.method || 'GET',
      headers: reqHeaders,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });

  let response = await doFetch();

  // Si la sesión expiró (401), re-autenticar y reintentar 1 vez
  if (response.status === 401) {
    sessionCache.cookieHeader = null;
    sessionCache.expiresAt = null;
    session = await loginToSap();
    reqHeaders['Cookie'] = session.cookieHeader;
    response = await doFetch();
  }

  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  const ok = response.status >= 200 && response.status < 300;
  return { status: response.status, ok, data, error: ok ? undefined : sapErrorMessage(data, response.status) };
}

/**
 * Diagnóstico del estado de la conexión a SAP Service Layer.
 * No devuelve el SessionId ni el usuario técnico (la respuesta es pública).
 */
export async function checkSapConnection() {
  try {
    const config = getSapConfig();
    const session = await getValidSapSession();
    return {
      ok: true,
      connected: true,
      companyDB: config.companyDB,
      version: session.version,
      dryRunForced: process.env.SAP_DRY_RUN === '1' || process.env.SAP_WRITES_ENABLED !== '1',
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      ok: false,
      connected: false,
      error: error.message || 'No se pudo conectar a SAP Service Layer',
      timestamp: new Date().toISOString(),
    };
  }
}

/** Obtener Órdenes de Venta desde SAP Service Layer */
export async function getSapOrders(maxPageSize = 10) {
  return await sapFetch('Orders?$select=DocEntry,DocNum,CardCode,CardName,DocTotal,DocumentStatus&$orderby=DocEntry desc', { maxPageSize });
}

/** Obtener Catálogo Maestro de Items / Productos desde SAP Service Layer */
export async function getSapItems(maxPageSize = 10) {
  return await sapFetch('Items?$select=ItemCode,ItemName,ItemsGroupCode,Valid', { maxPageSize });
}

/** Obtener Clientes / Socios de Negocios desde SAP Service Layer */
export async function getSapBusinessPartners(maxPageSize = 10) {
  return await sapFetch('BusinessPartners?$select=CardCode,CardName,CardType,Valid', { maxPageSize });
}
