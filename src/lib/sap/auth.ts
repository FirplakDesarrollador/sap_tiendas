// Autenticación de las rutas /api/sap/* con la sesión de Supabase Auth del portal.
// El cliente envía el access token de Supabase en `Authorization: Bearer <token>`.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export interface ApiUser {
  id: string;
  email?: string;
}

export async function getApiUser(request: NextRequest): Promise<ApiUser | null> {
  const auth = request.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email };
}

/** Devuelve el usuario o una respuesta 401 lista para retornar. */
export async function requireUser(request: NextRequest): Promise<ApiUser | NextResponse> {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'No autenticado. Inicia sesión en el portal para consultar SAP.' },
      { status: 401 }
    );
  }
  return user;
}
