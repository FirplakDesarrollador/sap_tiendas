# sap_tiendas

Portal Corporativo de Servicios y Gestión Comercial para SAP Tiendas - **Firplak S.A.**

## 🚀 Características
- **Autenticación Corporativa**: Integración con Supabase Auth y validación de roles de usuario (`public.Usuarios`).
- **Integración SAP Service Layer**: Conexión directa a SAP Business One (`Firplak_SA`) para sincronización de datos operativos en tiempo real.
- **Barra Lateral de Navegación (*Slide Bar*)**: Diseño responsive con navegación colapsable, estados de conexión en vivo y vistas modulares.
- **Módulo Tiendas y Sucursales**: Gestión integral de puntos de venta y enlace a `public.Ubicaciones`.

## 🛠️ Tecnologías
- **Framework**: Next.js 16 (App Router) + React 19
- **Estilos**: Vanilla CSS Modules con diseño corporativo premium
- **Base de Datos & Auth**: Supabase Cloud
- **ERP**: SAP Business One Service Layer (OData / REST)
- **Iconografía**: Lucide React

## ⚙️ Configuración

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/FirplakDesarrollador/sap_tiendas.git
   cd sap_tiendas
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Configurar variables de entorno en `.env.local` (ver `.env.example`):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   SAP_BASE_URL=https://servidor-sap:50000/b1s/v1
   SAP_COMPANY_DB=Firplak_SA
   SAP_USERNAME=manager
   SAP_PASSWORD="tu-password"
   ```

4. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

5. Abrir [http://localhost:3000](http://localhost:3000) o el puerto asignado.
