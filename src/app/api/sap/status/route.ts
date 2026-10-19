import { NextResponse } from 'next/server';
import { checkSapConnection } from '@/lib/sap/serviceLayer';

export async function GET() {
  try {
    const status = await checkSapConnection();
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        connected: false,
        error: error.message || 'Error al conectar con SAP Service Layer',
      },
      { status: 500 }
    );
  }
}
