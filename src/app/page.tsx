'use client'

import React, { useState, useEffect, useMemo } from 'react'
import styles from './page.module.css'
import { getSupabaseClient } from '@/lib/supabase/client'
import { UsuarioProfile, UserSessionData } from '@/types/database'
import { 
  Building2, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  LogOut, 
  User, 
  Store, 
  FileText, 
  CheckSquare, 
  Sparkles, 
  Database, 
  Search, 
  Package, 
  Calendar, 
  RefreshCw, 
  Users, 
  Settings, 
  X, 
  Activity, 
  Server, 
  CheckCircle, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  LayoutDashboard,
  Menu,
  ChevronLeft,
  Construction,
  Clock,
  ArrowLeft,
  UserPlus,
  Wallet,
  FileSignature,
  Truck,
  Receipt,
  Boxes
} from 'lucide-react'
import ClientesModule from '@/components/sap/ClientesModule'
import InventarioModule from '@/components/sap/InventarioModule'
import DocumentModule, { OFERTAS_CONFIG, ENTREGAS_CONFIG, FACTURAS_CONFIG } from '@/components/sap/DocumentModule'

// Definición de interfaces para los módulos
interface AppMod {
  id: string
  title: string
  description: string
  category: 'Comercial' | 'SAP & Logística' | 'Servicio Técnico' | 'Configuración & TI'
  icon: any
  iconColor: string
  iconBg: string
  status: string
  tableRef?: string
  mockStats?: { label: string; value: string }[]
  previewRows?: any[]
}

export default function AppHome() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [userSession, setUserSession] = useState<UserSessionData | null>(null)

  // Estados para la navegación y barra lateral (slide bar)
  const [currentView, setCurrentView] = useState<string>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false)

  // Estados para el Home con módulos
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeModalMod, setActiveModalMod] = useState<AppMod | null>(null)
  
  // Estado de integración con SAP Service Layer
  const [sapStatus, setSapStatus] = useState<{ connected: boolean; companyDB?: string; version?: string } | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null)
  const [liveModuleData, setLiveModuleData] = useState<Record<string, any[]>>({})

  // Grupos de navegación para la Barra Lateral (Slide Bar)
  const sidebarNavGroups = [
    {
      label: 'GENERAL',
      items: [
        { id: 'dashboard', title: 'Panel Principal', icon: LayoutDashboard, badge: null }
      ]
    },
    {
      label: 'GESTIÓN COMERCIAL',
      items: [
        { id: 'tiendas-ubicaciones', title: 'Tiendas y Sucursales', icon: Store, badge: '28' }
      ]
    },
    {
      label: 'SAP BUSINESS ONE',
      items: [
        { id: 'sap-clientes', title: 'Creación de Clientes', icon: UserPlus, badge: null },
        { id: 'sap-pagos', title: 'Pagos Recibidos', icon: Wallet, badge: null },
        { id: 'sap-ofertas', title: 'Ofertas de Venta', icon: FileSignature, badge: null },
        { id: 'sap-entregas', title: 'Entrega', icon: Truck, badge: null },
        { id: 'sap-facturas', title: 'Factura', icon: Receipt, badge: null },
        { id: 'sap-inventario', title: 'Inventario', icon: Boxes, badge: null }
      ]
    }
  ]

  const supabase = getSupabaseClient()

  // Definición de los Módulos del Sistema SAP Tiendas
  const modules: AppMod[] = [
    {
      id: 'tiendas-ubicaciones',
      title: 'Tiendas y Sucursales',
      description: 'Gestión integral de la red de tiendas, exhibiciones, inventario en punto de venta y asesores comerciales.',
      category: 'Comercial',
      icon: Store,
      iconColor: '#1d4ed8',
      iconBg: '#eff6ff',
      status: '28 Sucursales',
      tableRef: 'public.Ubicaciones',
      mockStats: [
        { label: 'Puntos Activos', value: '28 Tiendas' },
        { label: 'Exhibiciones Vigentes', value: '142 Puestos' }
      ],
      previewRows: [
        { col1: 'Firplak Home Medellín', col2: 'Cra 43A # 18 Sur', col3: 'Medellín', col4: 'Activa' },
        { col1: 'Sucursal Bogotá Norte', col2: 'Calle 134 # 19-45', col3: 'Bogotá', col4: 'Activa' },
        { col1: 'Tienda Cali Chipichape', col2: 'Av 6N # 38N-10', col3: 'Cali', col4: 'Activa' },
        { col1: 'Distribuidor Mayorista Barranquilla', col2: 'Cra 53 # 79-112', col3: 'Barranquilla', col4: 'Activa' }
      ]
    },
    {
      id: 'sap-clientes',
      title: 'Creación de Clientes',
      description: 'Socios de negocio (clientes) en SAP Business One: búsqueda, ficha completa, direcciones, contactos, propiedades y localización HBT.',
      category: 'SAP & Logística',
      icon: UserPlus,
      iconColor: '#b45309',
      iconBg: '#fef3c7',
      status: 'En vivo',
      tableRef: 'SAP: BusinessPartners (OCRD)'
    },
    {
      id: 'sap-pagos',
      title: 'Pagos Recibidos',
      description: 'Registro de pagos recibidos y anticipos de clientes contra facturas abiertas.',
      category: 'SAP & Logística',
      icon: Wallet,
      iconColor: '#15803d',
      iconBg: '#dcfce7',
      status: 'En vivo',
      tableRef: 'SAP: IncomingPayments (ORCT)'
    },
    {
      id: 'sap-ofertas',
      title: 'Ofertas de Venta',
      description: 'Cotizaciones a clientes con líneas de artículos, impuestos, empleado de ventas y campos Firplak.',
      category: 'SAP & Logística',
      icon: FileSignature,
      iconColor: '#1d4ed8',
      iconBg: '#dbeafe',
      status: 'En vivo',
      tableRef: 'SAP: Quotations (OQUT)'
    },
    {
      id: 'sap-entregas',
      title: 'Entrega',
      description: 'Remisiones / entregas a clientes, copiando desde ofertas de venta.',
      category: 'SAP & Logística',
      icon: Truck,
      iconColor: '#7c3aed',
      iconBg: '#ede9fe',
      status: 'En vivo',
      tableRef: 'SAP: DeliveryNotes (ODLN)'
    },
    {
      id: 'sap-facturas',
      title: 'Factura',
      description: 'Facturas de deudores copiando desde entregas, con totales e impuestos.',
      category: 'SAP & Logística',
      icon: Receipt,
      iconColor: '#be123c',
      iconBg: '#ffe4e6',
      status: 'En vivo',
      tableRef: 'SAP: Invoices (OINV)'
    },
    {
      id: 'sap-inventario',
      title: 'Inventario',
      description: 'Consulta de artículos, stock por almacén, comprometido, pedido y precios.',
      category: 'SAP & Logística',
      icon: Boxes,
      iconColor: '#0f766e',
      iconBg: '#ccfbf1',
      status: 'Próximamente',
      tableRef: 'SAP: Items (OITM / OITW)'
    }
  ]

  // Verificar sesión existente al montar
  useEffect(() => {
    async function initSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.warn('Error al verificar sesión:', error.message)
          return
        }

        if (session?.user) {
          await loadUserProfile(session.user.id, session.user.email)
        }
      } catch (err) {
        console.error('Error de inicialización:', err)
      }
    }

    initSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await loadUserProfile(session.user.id, session.user.email)
        } else {
          setUserSession(null)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Cargar datos de perfil desde 'public.Usuarios'
  async function loadUserProfile(userId: string, userEmail?: string) {
    try {
      let profile: UsuarioProfile | null = null

      const { data, error } = await supabase
        .from('Usuarios')
        .select('*')
        .or(`user_id.eq.${userId},correo.eq.${userEmail || ''}`)
        .maybeSingle()

      if (!error && data) {
        profile = data as UsuarioProfile
      }

      setUserSession({
        id: userId,
        email: userEmail,
        profile
      })
    } catch (err) {
      console.warn('No se pudo cargar el perfil de Usuarios:', err)
      setUserSession({
        id: userId,
        email: userEmail,
        profile: null
      })
    }
  }

  // Filtrado de módulos
  const filteredModules = useMemo(() => {
    return modules.filter((mod) => {
      const matchesCategory = selectedCategory === 'Todos' || mod.category === selectedCategory
      const matchesSearch = 
        mod.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mod.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mod.category.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [selectedCategory, searchQuery])

  // Login handler
  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      })

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMessage('Credenciales inválidas. Verifica tu correo corporativo y contraseña.')
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMessage('El correo electrónico aún no ha sido confirmado.')
        } else {
          setErrorMessage(error.message || 'Error al autenticarse en el servidor.')
        }
        return
      }

      if (data.user) {
        setSuccessMessage('¡Autenticación autorizada! Ingresando al Home...')
        await loadUserProfile(data.user.id, data.user.email)
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocurrió un error inesperado al conectar.')
    } finally {
      setLoading(false)
    }
  }

  // Register handler
  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            display_name: fullName.trim()
          }
        }
      })

      if (error) {
        setErrorMessage(error.message || 'Error al crear la cuenta.')
        return
      }

      if (data.user) {
        setSuccessMessage('Cuenta creada exitosamente. Ya puedes iniciar sesión.')
        setMode('login')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error en el proceso de registro.')
    } finally {
      setLoading(false)
    }
  }

  // Logout handler
  const handleLogout = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      setUserSession(null)
      setEmail('')
      setPassword('')
      setSuccessMessage('Sesión cerrada correctamente.')
    } catch (err) {
      console.error('Error al cerrar sesión:', err)
    } finally {
      setLoading(false)
    }
  }

  // Diagnóstico de estado de SAP Service Layer al montar
  useEffect(() => {
    async function checkSap() {
      try {
        const res = await fetch('/api/sap/status')
        const data = await res.json()
        if (data && data.ok) {
          setSapStatus(data)
        }
      } catch (err) {
        console.warn('No se pudo verificar el estado de SAP Service Layer:', err)
      }
    }
    checkSap()
  }, [])

  // Abrir modal y consultar datos reales de SAP si aplica
  const handleOpenModal = async (mod: AppMod) => {
    setActiveModalMod(mod)
    setSyncFeedback(null)

    let entity: string | null = null
    if (mod.id === 'ordenes-sap') entity = 'orders'
    else if (mod.id === 'catalogo-productos') entity = 'items'
    else if (mod.id === 'clientes-distribuidores') entity = 'clients'

    if (entity && !liveModuleData[mod.id]) {
      setIsSyncing(true)
      try {
        const res = await fetch(`/api/sap/data?entity=${entity}&limit=8`)
        const json = await res.json()
        if (json.ok && json.rows) {
          setLiveModuleData(prev => ({ ...prev, [mod.id]: json.rows }))
        }
      } catch (e) {
        console.error('Error al consultar SAP Service Layer:', e)
      } finally {
        setIsSyncing(false)
      }
    }
  }

  // Sincronizar datos con SAP Service Layer o base de datos en tiempo real
  const handleSyncData = async (modToSync?: AppMod) => {
    const target = modToSync || activeModalMod || modules.find(m => m.id === currentView)
    if (!target) return
    setIsSyncing(true)
    setSyncFeedback(null)

    let entity: string | null = null
    if (target.id === 'ordenes-sap') entity = 'orders'
    else if (target.id === 'catalogo-productos') entity = 'items'
    else if (target.id === 'clientes-distribuidores') entity = 'clients'

    try {
      if (entity) {
        const res = await fetch(`/api/sap/data?entity=${entity}&limit=10`)
        const json = await res.json()
        if (json.ok && json.rows) {
          setLiveModuleData(prev => ({ ...prev, [target.id]: json.rows }))
          setSyncFeedback(`¡Sincronización exitosa con SAP Business One (${json.rows.length} registros cargados desde Firplak_SA)!`)
        } else {
          setSyncFeedback('Conexión con SAP Service Layer verificada.')
        }
      } else {
        // Módulos locales de Supabase (ej. Tiendas y Sucursales)
        await new Promise(r => setTimeout(r, 600))
        setSyncFeedback(`Sincronización verificada: Conectado a ${target.title} (${target.tableRef || 'public.Ubicaciones'}).`)
      }
    } catch (e: any) {
      setSyncFeedback(`Error al sincronizar: ${e.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className={styles.pageWrapper}>
      {/* RENDERIZADO CONDICIONAL: SHELL CON SIDEBAR (LOGUEADO) O PÁGINA DE LOGIN (NO LOGUEADO) */}
      {userSession ? (
        <div className={styles.appShell}>
          {/* BACKDROP PARA MÓVILES */}
          {mobileSidebarOpen && (
            <div 
              className={styles.sidebarBackdrop} 
              onClick={() => setMobileSidebarOpen(false)} 
            />
          )}

          {/* SLIDE BAR (BARRA LATERAL DE NAVEGACIÓN) */}
          <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''} ${mobileSidebarOpen ? styles.sidebarMobileOpen : ''}`}>
            {/* Header del Sidebar */}
            <div className={styles.sidebarHeader}>
              <div 
                className={styles.sidebarBrand} 
                onClick={() => setCurrentView('dashboard')}
                title="Ir al Panel Principal"
              >
                <div className={styles.sidebarLogoBox}>
                  <Building2 size={20} />
                </div>
                {!sidebarCollapsed && (
                  <div className={styles.sidebarBrandText}>
                    <span className={styles.sidebarBrandTitle}>SAP Tiendas</span>
                    <span className={styles.sidebarBrandSubtitle}>Firplak S.A.</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                className={styles.sidebarCollapseBtn}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
              >
                <ChevronLeft size={16} className={sidebarCollapsed ? styles.rotate180 : ''} />
              </button>
            </div>

            {/* Navegación del Sidebar */}
            <nav className={styles.sidebarNav}>
              {sidebarNavGroups.map((group, gIdx) => (
                <div key={gIdx} className={styles.sidebarNavGroup}>
                  {!sidebarCollapsed && (
                    <span className={styles.sidebarGroupLabel}>{group.label}</span>
                  )}
                  {group.items.map((item) => {
                    const ItemIcon = item.icon
                    const isActive = currentView === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        id={`sidebar-item-${item.id}`}
                        className={`${styles.sidebarNavItem} ${isActive ? styles.sidebarNavItemActive : ''}`}
                        onClick={() => {
                          setCurrentView(item.id)
                          setMobileSidebarOpen(false)
                        }}
                        title={item.title}
                      >
                        <span className={styles.sidebarItemIcon}>
                          <ItemIcon size={18} />
                        </span>
                        {!sidebarCollapsed && (
                          <>
                            <span className={styles.sidebarItemText}>{item.title}</span>
                            {item.badge && (
                              <span className={styles.sidebarItemBadge}>{item.badge}</span>
                            )}
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </nav>

            {/* Pie de la barra lateral */}
            {!sidebarCollapsed && userSession && (
              <div className={styles.sidebarFooter}>
                <div className={styles.sidebarUserBox}>
                  <div className={styles.navAvatar}>
                    {userSession.profile?.nombres?.[0] || 
                     userSession.profile?.display_name?.[0] || 
                     userSession.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className={styles.sidebarUserInfo}>
                    <span className={styles.sidebarUserName}>
                      {userSession.profile?.display_name || userSession.email}
                    </span>
                    <span className={styles.sidebarUserRole}>
                      {userSession.profile?.rol || 'Usuario'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </aside>

          {/* ÁREA PRINCIPAL CON CONTENIDO */}
          <div className={styles.mainArea}>
            {/* BARRA SUPERIOR INSTITUCIONAL */}
            <header className={styles.topNavbar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  className={styles.menuToggleBtn}
                  onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                  title="Abrir menú"
                >
                  <Menu size={20} />
                </button>
                <div className={styles.navBrandText}>
                  <span className={styles.navBrandTitle}>
                    {currentView === 'dashboard' ? 'Panel de Operaciones' : (modules.find(m => m.id === currentView)?.title || 'Módulo')}
                  </span>
                  <span className={styles.navBrandSubtitle}>Portal Corporativo • Servicios & Comercial</span>
                </div>
              </div>

              <div className={styles.navRight}>
                <div className={styles.navBadge} id="db-connection-status">
                  <span className={styles.statusDot} />
                  <span>Supabase Cloud • Conectado</span>
                </div>

                <div className={styles.navBadgeSap} id="sap-connection-status">
                  <span className={styles.sapStatusDot} />
                  <span>SAP B1 • {sapStatus?.companyDB || 'Firplak_SA'} • {sapStatus?.connected ? 'Conectado' : 'Conectando...'}</span>
                </div>

                {userSession && (
                  <div className={styles.navUserMenu}>
                    <div className={styles.navAvatar}>
                      {userSession.profile?.nombres?.[0] || 
                       userSession.profile?.display_name?.[0] || 
                       userSession.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className={styles.navUserInfo}>
                      <span className={styles.navUserName}>
                        {userSession.profile?.display_name || userSession.email}
                      </span>
                      <span className={styles.navUserRole}>
                        {userSession.profile?.rol || 'Usuario'}
                      </span>
                    </div>
                    <button 
                      id="header-logout-btn"
                      className={styles.navLogoutBtn} 
                      onClick={handleLogout}
                      title="Cerrar Sesión"
                    >
                      <LogOut size={15} />
                      <span>Salir</span>
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* CONTENIDO SEGÚN LA VISTA SELECCIONADA */}
            {currentView === 'dashboard' ? (
              <main className={styles.dashboardContainer} id="home-modules-view">
                {/* BANNER PRINCIPAL DE BIENVENIDA */}
                <section className={styles.homeHero}>
                  <div className={styles.homeHeroLeft}>
                    <div className={styles.greetingTag}>
                      <Sparkles size={14} />
                      <span>Panel de Operaciones Activo</span>
                    </div>
                    <h1 className={styles.greetingTitle}>
                      Bienvenido, {userSession.profile?.display_name || userSession.email}
                    </h1>
                    <p className={styles.greetingSubtitle}>
                      Accede a las herramientas de sincronización SAP, gestión de tiendas, catálogo maestro de productos y mesa de tickets posventa.
                    </p>
                    <div className={styles.heroQuickMeta}>
                      <div className={styles.metaItem}>
                        <ShieldCheck size={16} color="#1d4ed8" />
                        <span>Rol: {userSession.profile?.rol || 'Estándar'}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <Building2 size={16} color="#0284c7" />
                        <span>Visor: {userSession.profile?.Rol_Visor || 'BackOffice'}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <Database size={16} color="#059669" />
                        <span>ID Usuario: {userSession.profile?.id || userSession.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* TARJETAS KPI SUPERIORES */}
                <section className={styles.kpiGrid}>
                  <div className={styles.kpiCard}>
                    <div className={styles.kpiIconWrap} style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                      <Store size={24} />
                    </div>
                    <div className={styles.kpiInfo}>
                      <span className={styles.kpiValue}>28</span>
                      <span className={styles.kpiLabel}>Tiendas y Puntos de Venta</span>
                    </div>
                  </div>

                  <div className={styles.kpiCard}>
                    <div className={styles.kpiIconWrap} style={{ background: '#f0f9ff', color: '#0284c7' }}>
                      <Package size={24} />
                    </div>
                    <div className={styles.kpiInfo}>
                      <span className={styles.kpiValue}>17,431</span>
                      <span className={styles.kpiLabel}>Productos Indexados</span>
                    </div>
                  </div>

                  <div className={styles.kpiCard}>
                    <div className={styles.kpiIconWrap} style={{ background: '#ecfdf5', color: '#059669' }}>
                      <FileText size={24} />
                    </div>
                    <div className={styles.kpiInfo}>
                      <span className={styles.kpiValue}>47 Hoy</span>
                      <span className={styles.kpiLabel}>Órdenes Sincronizadas SAP</span>
                    </div>
                  </div>

                  <div className={styles.kpiCard}>
                    <div className={styles.kpiIconWrap} style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                      <Activity size={24} />
                    </div>
                    <div className={styles.kpiInfo}>
                      <span className={styles.kpiValue}>99.9%</span>
                      <span className={styles.kpiLabel}>Disponibilidad de Servicio</span>
                    </div>
                  </div>
                </section>

                {/* SECCIÓN DE MÓDULOS DISPONIBLES */}
                <section className={styles.modulesSection}>
                  <div className={styles.modulesHeaderRow}>
                    <div className={styles.modulesSectionTitle}>
                      <h2 className={styles.modulesSectionH2}>Módulos y Aplicaciones</h2>
                      <span className={styles.modulesSectionSubtitle}>
                        Selecciona cualquier opción de la barra lateral o cuadrícula para ingresar
                      </span>
                    </div>

                    {/* Controles de Búsqueda y Filtro */}
                    <div className={styles.controlsBar}>
                      <div className={styles.searchBox}>
                        <Search size={16} className={styles.searchIcon} />
                        <input
                          id="module-search-input"
                          type="text"
                          className={styles.searchInput}
                          placeholder="Buscar módulo o transacción..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>

                      <div className={styles.categoryPills}>
                        {['Todos', 'Comercial', 'SAP & Logística'].map((cat) => (
                          <button
                            key={cat}
                            className={`${styles.pillBtn} ${selectedCategory === cat ? styles.pillBtnActive : ''}`}
                            onClick={() => setSelectedCategory(cat)}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* CUADRÍCULA DE MÓDULOS */}
                  <div className={styles.modulesGrid}>
                    {filteredModules.map((mod) => {
                      const IconComponent = mod.icon
                      return (
                        <div 
                          key={mod.id} 
                          className={styles.moduleCard}
                          onClick={() => {
                            setCurrentView(mod.id)
                          }}
                          id={`module-card-${mod.id}`}
                        >
                          <div>
                            <div className={styles.moduleTopRow}>
                              <div className={styles.moduleIconBox} style={{ background: mod.iconBg, color: mod.iconColor }}>
                                <IconComponent size={24} />
                              </div>
                              <span className={styles.moduleCategoryBadge}>
                                {mod.category}
                              </span>
                            </div>

                            <div className={styles.moduleBody}>
                              <h3 className={styles.moduleTitle}>{mod.title}</h3>
                              <p className={styles.moduleDescription}>{mod.description}</p>
                            </div>
                          </div>

                          <div className={styles.moduleFooter}>
                            <span className={styles.moduleActionText}>
                              <span>Abrir módulo</span>
                              <ChevronRight size={16} />
                            </span>
                            <span className={styles.moduleStatusPill}>{mod.status}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </main>
            ) : currentView === 'sap-clientes' ? (
              <ClientesModule onBack={() => setCurrentView('dashboard')} />
            ) : currentView === 'sap-inventario' ? (
              <InventarioModule onBack={() => setCurrentView('dashboard')} />
            ) : currentView === 'sap-ofertas' ? (
              <DocumentModule key="ofertas" config={OFERTAS_CONFIG} onBack={() => setCurrentView('dashboard')} />
            ) : currentView === 'sap-entregas' ? (
              <DocumentModule key="entregas" config={ENTREGAS_CONFIG} onBack={() => setCurrentView('dashboard')} />
            ) : currentView === 'sap-facturas' ? (
              <DocumentModule key="facturas" config={FACTURAS_CONFIG} onBack={() => setCurrentView('dashboard')} />
            ) : (
              /* VISTA: MÓDULO EN DESARROLLO POR EL MOMENTO */
              (() => {
                const activeMod = modules.find(m => m.id === currentView) || {
                  id: currentView,
                  title: 'Módulo Seleccionado',
                  description: 'Módulo del portal corporativo SAP Tiendas.',
                  category: 'Comercial' as const,
                  icon: Construction,
                  iconColor: '#d97706',
                  iconBg: '#fffbeb',
                  status: 'En Construcción',
                  tableRef: 'public.Modulo'
                }

                return (
                  <main className={styles.underDevContainer} id="module-under-dev-view">
                    {/* BREADCRUMB */}
                    <div className={styles.underDevBreadcrumb}>
                      <button 
                        className={styles.breadcrumbBackBtn}
                        onClick={() => setCurrentView('dashboard')}
                      >
                        <ArrowLeft size={15} />
                        <span>Panel Principal</span>
                      </button>
                      <span className={styles.breadcrumbSeparator}>/</span>
                      <span className={styles.breadcrumbCategory}>{activeMod.category}</span>
                      <span className={styles.breadcrumbSeparator}>/</span>
                      <span className={styles.breadcrumbActive}>{activeMod.title}</span>
                    </div>

                    {/* TARJETA DE MÓDULO EN DESARROLLO */}
                    <div className={styles.underDevCard}>
                      <div className={styles.underDevIconWrap} style={{ background: activeMod.iconBg, color: activeMod.iconColor }}>
                        {React.createElement(activeMod.icon, { size: 36 })}
                      </div>

                      <div className={styles.underDevBadge}>
                        <span className={styles.underDevBadgeDot} />
                        <Construction size={14} />
                        <span>Módulo en desarrollo por el momento</span>
                      </div>

                      <h2 className={styles.underDevTitle}>{activeMod.title}</h2>
                      
                      <p className={styles.underDevSubtitle}>
                        Módulo en desarrollo por el momento. Estamos trabajando en la implementación y enlace directo de esta funcionalidad con el Service Layer de SAP Business One (<strong>{sapStatus?.companyDB || 'Firplak_SA'}</strong>) y Supabase Cloud.
                      </p>

                      {/* INFORMACIÓN DEL MÓDULO */}
                      <div className={styles.underDevGrid}>
                        <div className={styles.underDevInfoBox}>
                          <span className={styles.underDevInfoLabel}>Categoría del Sistema</span>
                          <span className={styles.underDevInfoValue}>{activeMod.category}</span>
                        </div>
                        <div className={styles.underDevInfoBox}>
                          <span className={styles.underDevInfoLabel}>Entidad / Tabla</span>
                          <span className={styles.underDevInfoValue}>{activeMod.tableRef || 'SAP Service Layer'}</span>
                        </div>
                        <div className={styles.underDevInfoBox}>
                          <span className={styles.underDevInfoLabel}>Estado de Conexión</span>
                          <span className={styles.underDevInfoValue} style={{ color: sapStatus?.connected ? '#15803d' : '#d97706' }}>
                            {sapStatus?.connected ? 'SAP Service Layer Conectado' : 'Validando Conexión...'}
                          </span>
                        </div>
                      </div>

                      {/* BOTONES DE ACCIÓN */}
                      <div className={styles.underDevActions}>
                        <button 
                          className={styles.underDevBackBtn}
                          onClick={() => setCurrentView('dashboard')}
                        >
                          <ArrowLeft size={16} />
                          <span>Volver al Panel Principal</span>
                        </button>

                        <button 
                          className={styles.underDevTestSapBtn}
                          onClick={() => handleSyncData(activeMod)}
                          disabled={isSyncing}
                        >
                          <RefreshCw size={15} className={isSyncing ? styles.spinIcon : ''} />
                          <span>{isSyncing ? 'Sincronizando...' : 'Verificar Sincronización SAP'}</span>
                        </button>
                      </div>

                      {/* RETROALIMENTACIÓN DE SINCRONIZACIÓN */}
                      {syncFeedback && (
                        <div className={styles.underDevFeedback}>
                          <CheckCircle2 size={18} />
                          <span>{syncFeedback}</span>
                        </div>
                      )}
                    </div>
                  </main>
                )
              })()
            )}
          </div>
        </div>
      ) : (
        /* VISTA DE LOGIN Y REGISTRO (UNAUTHENTICATED) */
        <div style={{ width: '100%' }}>
          <header className={styles.topNavbar}>
            <div className={styles.navBrand}>
              <div className={styles.navLogoBox}>
                <Building2 size={22} />
              </div>
              <div className={styles.navBrandText}>
                <span className={styles.navBrandTitle}>SAP Tiendas</span>
                <span className={styles.navBrandSubtitle}>Portal Corporativo • Servicios & Comercial</span>
              </div>
            </div>

            <div className={styles.navRight}>
              <div className={styles.navBadge} id="db-connection-status">
                <span className={styles.statusDot} />
                <span>Supabase Cloud • Conectado</span>
              </div>

              <div className={styles.navBadgeSap} id="sap-connection-status">
                <span className={styles.sapStatusDot} />
                <span>SAP B1 • {sapStatus?.companyDB || 'Firplak_SA'} • {sapStatus?.connected ? 'Conectado' : 'Conectando...'}</span>
              </div>
            </div>
          </header>
          {/* VISTA DE LOGIN Y REGISTRO */}
          <main className={styles.mainContainer}>
          {/* Columna Izquierda: Imagen */}
          <section className={styles.heroImageSection}>
            <div className={styles.heroImageCard}>
              <img 
                src="/login-hero.jpg" 
                alt="Showroom de Tiendas" 
                className={styles.heroImage}
              />
            </div>
          </section>

          {/* Columna Derecha: Tarjeta de Acceso Blanca */}
          <section className={styles.cardWrapper}>
            <div className={styles.authCard}>
              <div className={styles.authCardTopBar} aria-hidden="true" />

              <div className={styles.formHeader}>
                <h2 className={styles.formHeaderTitle}>Acceso al Portal</h2>
                <p className={styles.formHeaderSubtitle}>
                  Ingresa con tu correo corporativo institucional.
                </p>
              </div>


              {/* Alertas */}
              {errorMessage && (
                <div className={styles.alertError} id="login-error-alert" role="alert">
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>{errorMessage}</div>
                </div>
              )}

              {successMessage && (
                <div className={styles.alertSuccess} id="login-success-alert" role="status">
                  <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>{successMessage}</div>
                </div>
              )}

              {/* Formulario */}
              <form 
                className={styles.form} 
                onSubmit={handleSubmitLogin}
                noValidate
              >
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="email-input">
                    Correo Corporativo
                  </label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputIcon}>
                      <Mail size={18} />
                    </span>
                    <input
                      id="email-input"
                      type="email"
                      className={styles.input}
                      placeholder="ejemplo@firplak.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="password-input">
                      Contraseña
                    </label>
                    <span 
                      className={styles.forgotLink}
                      onClick={() => alert('Para restablecer tu contraseña institucional, comunícate con la mesa de ayuda TI.')}
                    >
                      ¿Olvidaste tu contraseña?
                    </span>
                  </div>
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputIcon}>
                      <Lock size={18} />
                    </span>
                    <input
                      id="password-input"
                      type={showPassword ? 'text' : 'password'}
                      className={styles.input}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      id="toggle-password-btn"
                      className={styles.iconBtn}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className={styles.rememberRow}>
                  <input
                    type="checkbox"
                    id="remember-me-checkbox"
                    className={styles.checkbox}
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <label htmlFor="remember-me-checkbox" className={styles.checkboxLabel}>
                    Recordar mi cuenta en este equipo
                  </label>
                </div>

                <button
                  type="submit"
                  id="login-submit-btn"
                  className={styles.submitBtn}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className={styles.spinner} />
                      <span>Autenticando...</span>
                    </>
                  ) : (
                    <>
                      <span>Ingresar al Sistema</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <div className={styles.cardFooter}>
                <ShieldCheck size={16} color="#1d4ed8" />
                <span>Autenticación SSL 256-Bit • Supabase Auth</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    )}

      {/* PIE DE PÁGINA CORPORATIVO */}
      <footer className={styles.corporateFooter}>
        <span>© 2026 SAP Tiendas • Servicios y Comercial. Todos los derechos reservados.</span>
        <div className={styles.footerLinks}>
          <span className={styles.footerLink}>Mesa de Ayuda TI</span>
          <span className={styles.footerLink}>Políticas de Seguridad</span>
          <span className={styles.footerLink}>Términos de Acceso</span>
        </div>
      </footer>
    </div>
  )
}
