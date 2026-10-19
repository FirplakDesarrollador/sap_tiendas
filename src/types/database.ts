export interface UsuarioProfile {
  id: number
  created_at?: string
  user_id: string | null
  display_name: string | null
  rol: string | null
  nombres: string | null
  apellidos: string | null
  url_foto: string | null
  correo: string
  cedula: string | null
  debe_actualizar?: boolean
  Rol_Visor: string | null
  sucursal_predeterminada: number | null
  Vendedor_asignado: string | null
  acceso_a_modulos: any
}

export interface UserSessionData {
  id: string
  email?: string
  profile?: UsuarioProfile | null
}
