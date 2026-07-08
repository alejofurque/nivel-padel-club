/* =========================================================
   Auth: login con roles.
   - Con Supabase configurado usa Supabase Auth (contraseñas
     hasheadas por Supabase, nunca en tablas propias) y lee el
     rol desde la tabla `profiles`.
   - El login pide "usuario" y "contraseña"; internamente el
     username se mapea a un email técnico:
       admin      → admin@nivelpadel.local
       recepcion  → recepcion@nivelpadel.local
   - Sin Supabase, cae a un login simulado con los mismos
     usuarios demo (solo para desarrollo/demo sin conexión;
     documentado como limitación académica).
   ========================================================= */

const Auth = {

  sesion: null, // { username, role: 'admin' | 'recepcionista' }

  DOMINIO_TECNICO: 'nivelpadel.local',

  // Usuarios del modo local (mock). En modo nube NO se usan:
  // las credenciales las valida Supabase Auth.
  USUARIOS_DEMO: {
    admin: { clave: 'admin123', role: 'admin' },
    recepcion: { clave: 'recepcion123', role: 'recepcionista' },
  },

  ROLES: {
    admin: 'Administrador',
    recepcionista: 'Recepcionista',
  },

  modoNube() {
    return DB.configurado;
  },

  async iniciarSesion(usuario, clave) {
    usuario = String(usuario || '').trim().toLowerCase();
    if (!usuario || !clave) throw new Error('Ingresá usuario y contraseña.');

    if (Auth.modoNube()) {
      const email = `${usuario}@${Auth.DOMINIO_TECNICO}`;
      const { data, error } = await DB.cliente.auth.signInWithPassword({ email, password: clave });
      if (error) throw new Error('Usuario o contraseña incorrectos.');
      Auth.sesion = await Auth._cargarPerfil(data.user);
    } else {
      const u = Auth.USUARIOS_DEMO[usuario];
      if (!u || u.clave !== clave) throw new Error('Usuario o contraseña incorrectos.');
      Auth.sesion = { username: usuario, role: u.role };
      sessionStorage.setItem('nivelpadel_sesion', JSON.stringify(Auth.sesion));
    }
    return Auth.sesion;
  },

  async restaurar() {
    if (Auth.modoNube()) {
      const { data } = await DB.cliente.auth.getSession();
      if (!data?.session?.user) return null;
      Auth.sesion = await Auth._cargarPerfil(data.session.user);
    } else {
      try {
        Auth.sesion = JSON.parse(sessionStorage.getItem('nivelpadel_sesion')) || null;
      } catch {
        Auth.sesion = null;
      }
    }
    return Auth.sesion;
  },

  async _cargarPerfil(user) {
    const { data: perfil } = await DB.cliente
      .from('profiles').select('username, role').eq('user_id', user.id).single();
    return {
      username: perfil?.username || String(user.email || '').split('@')[0],
      role: perfil?.role === 'admin' ? 'admin' : 'recepcionista',
    };
  },

  async cerrarSesion() {
    if (Auth.modoNube()) {
      try { await DB.cliente.auth.signOut(); } catch { /* la sesión local se limpia igual */ }
    }
    sessionStorage.removeItem('nivelpadel_sesion');
    Auth.sesion = null;
  },

  usuario() {
    return Auth.sesion;
  },

  esAdmin() {
    return Auth.sesion?.role === 'admin';
  },

  rolLegible() {
    return Auth.ROLES[Auth.sesion?.role] || '';
  },
};
