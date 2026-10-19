// Cliente de integración con SAP Business One Service Layer
// Firplak S.A.

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

// Permitir certificados autofirmados para el Service Layer corporativo
if (typeof process !== 'undefined' && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

function getSapConfig() {
  const baseUrl = process.env.SAP_BASE_URL || 'https://200.7.96.194:50000/b1s/v1';
  const companyDB = process.env.SAP_COMPANY_DB || 'Firplak_SA';
  const userName = process.env.SAP_USERNAME || 'manager';
  const password = process.env.SAP_PASSWORD || '2023Fir#.*';

  return { baseUrl, companyDB, userName, password };
}

/**
 * Autenticación contra el endpoint /Login de SAP Service Layer
 */
export async function loginToSap(): Promise<{ cookieHeader: string; sessionId: string; version: string }> {
  const config = getSapConfig();

  const response = await fetch(`${config.baseUrl}/Login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      CompanyDB: config.companyDB,
      UserName: config.userName,
      Password: config.password,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error de autenticación SAP Service Layer (${response.status}): ${errorText}`);
  }

  // Extraer cookies B1SESSION y ROUTEID
  let rawCookies: string[] = [];
  if (typeof (response.headers as any).getSetCookie === 'function') {
    rawCookies = (response.headers as any).getSetCookie();
  } else {
    const cookieHeader = response.headers.get('set-cookie');
    if (cookieHeader) {
      rawCookies = cookieHeader.split(/,(?=\s*[A-Za-z0-9_-]+=)/);
    }
  }

  const cookiePairs = rawCookies.map(c => c.split(';')[0].trim()).filter(Boolean);
  const cookieHeader = cookiePairs.join('; ');

  const data = await response.json();
  const sessionId = data.SessionId || '';
  const version = data.Version || '';

  // Almacenar en caché por 25 minutos (el timeout default en SAP es 30 min)
  sessionCache.cookieHeader = cookieHeader;
  sessionCache.sessionId = sessionId;
  sessionCache.version = version;
  sessionCache.expiresAt = Date.now() + 25 * 60 * 1000;

  return { cookieHeader, sessionId, version };
}

/**
 * Obtener sesión activa válida (reutiliza o autentica si expiró)
 */
export async function getValidSapSession(): Promise<{ cookieHeader: string; sessionId: string; version: string }> {
  if (
    sessionCache.cookieHeader &&
    sessionCache.expiresAt &&
    Date.now() < sessionCache.expiresAt
  ) {
    return {
      cookieHeader: sessionCache.cookieHeader,
      sessionId: sessionCache.sessionId || '',
      version: sessionCache.version || '',
    };
  }

  return await loginToSap();
}

/**
 * Petición genérica al SAP Service Layer con reintento automático si expira la sesión
 */
export async function sapFetch<T = any>(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    maxPageSize?: number;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; data: T }> {
  const config = getSapConfig();
  const url = endpoint.startsWith('http') ? endpoint : `${config.baseUrl}/${endpoint.replace(/^\//, '')}`;
  
  let session = await getValidSapSession();

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cookie': session.cookieHeader,
    ...(options.headers || {}),
  };

  if (options.maxPageSize) {
    reqHeaders['Prefer'] = `odata.maxpagesize=${options.maxPageSize}`;
  }

  let response = await fetch(url, {
    method: options.method || 'GET',
    headers: reqHeaders,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  // Si la sesión expiró (401), re-autenticar y reintentar 1 vez
  if (response.status === 401) {
    sessionCache.cookieHeader = null;
    sessionCache.expiresAt = null;
    session = await loginToSap();
    reqHeaders['Cookie'] = session.cookieHeader;

    response = await fetch(url, {
      method: options.method || 'GET',
      headers: reqHeaders,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
  }

  const text = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: response.status, data };
}

/**
 * Diagnóstico del estado de la conexión a SAP Service Layer
 */
export async function checkSapConnection() {
  try {
    const config = getSapConfig();
    const session = await getValidSapSession();
    return {
      ok: true,
      connected: true,
      companyDB: config.companyDB,
      userName: config.userName,
      baseUrl: config.baseUrl,
      version: session.version,
      sessionId: session.sessionId,
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

/**
 * Obtener Órdenes de Venta desde SAP Service Layer
 */
export async function getSapOrders(maxPageSize = 10) {
  return await sapFetch('Orders', { maxPageSize });
}

/**
 * Obtener Catálogo Maestro de Items / Productos desde SAP Service Layer
 */
export async function getSapItems(maxPageSize = 10) {
  return await sapFetch('Items', { maxPageSize });
}

/**
 * Obtener Clientes / Socios de Negocios desde SAP Service Layer
 */
export async function getSapBusinessPartners(maxPageSize = 10) {
  return await sapFetch('BusinessPartners', { maxPageSize });
}
