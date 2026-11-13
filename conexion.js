/* ==========================================================================
CONEXION.JS — CAPA DE CONEXIÓN A SUPABASE
MiControl | Autenticación y acceso a datos
========================================================================== */

/* 1. CONFIGURACIÓN DE SUPABASE */

const SUPABASE_URL = 'https://lmqgxqhwujrtglyiiyjr.supabase.co';

// Conservá aquí tu clave pública actual de Supabase.
const SUPABASE_KEY = 'sb_publishable_CePJYdnQu8w-H9G3wjDhJw_RGWryimX';

const URL_REDIRECCION = 'https://inglestecnico244-stack.github.io/control-emprendimiento/';

let clienteSupabase = null;
let emprendimientoActual = null;

if (
  typeof supabase !== 'undefined' &&
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_KEY
) {
  clienteSupabase = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  console.log('Supabase conectado correctamente.');
} else {
  console.error('No se pudo inicializar la conexión con Supabase.');
}

/* 2. FUNCIONES DE AUTENTICACIÓN */

const ConexionDB = {

  /* ----------------------------------------------------------
  REGISTRAR UNA CUENTA NUEVA
  ---------------------------------------------------------- */

  async registrarUsuario(datosUsuario) {
    if (!clienteSupabase) {
      return {
        exito: false,
        mensaje: 'No hay conexión con Supabase.'
      };
    }

    const { data, error } = await clienteSupabase.auth.signUp({
      email: datosUsuario.email,
      password: datosUsuario.password,

      options: {
        emailRedirectTo: URL_REDIRECCION,

        data: {
          nombre: datosUsuario.nombre,
          apellido: datosUsuario.apellido,
          nombre_emprendimiento: datosUsuario.nombre_emprendimiento
        }
      }
    });

    if (error) {
      console.error('Error en el registro:', error.message);

      return {
        exito: false,
        mensaje: error.message
      };
    }

    return {
      exito: true,
      data: data,
      mensaje: 'Registro realizado. Revisá tu correo para confirmar la cuenta.'
    };
  },

  /* ----------------------------------------------------------
  INICIAR SESIÓN
  ---------------------------------------------------------- */

  async iniciarSesion(email, password) {
    if (!clienteSupabase) {
      return {
        exito: false,
        mensaje: 'No hay conexión con Supabase.'
      };
    }

    const { data, error } = await clienteSupabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Error al iniciar sesión:', error.message);

      return {
        exito: false,
        mensaje: error.message
      };
    }

    return {
      exito: true,
      data: data
    };
  },

  /* ----------------------------------------------------------
  CERRAR SESIÓN
  ---------------------------------------------------------- */

  async cerrarSesion() {
    if (!clienteSupabase) return false;

    const { error } = await clienteSupabase.auth.signOut();

    if (error) {
      console.error('Error al cerrar sesión:', error.message);
      return false;
    }

    emprendimientoActual = null;

    return true;
  },

  /* ----------------------------------------------------------
  OBTENER LA SESIÓN ACTUAL
  ---------------------------------------------------------- */

  async obtenerSesion() {
    if (!clienteSupabase) return null;

    const { data, error } = await clienteSupabase.auth.getSession();

    if (error) {
      console.error('Error al obtener sesión:', error.message);
      return null;
    }

    return data.session;
  },

  /* ----------------------------------------------------------
  OBTENER EL USUARIO ACTUAL
  ---------------------------------------------------------- */

  async obtenerUsuario() {
    if (!clienteSupabase) return null;

    const { data, error } = await clienteSupabase.auth.getUser();

    if (error) {
      console.error('Error al obtener usuario:', error.message);
      return null;
    }

    return data.user;
  },

  /* ----------------------------------------------------------
  ESCUCHAR CAMBIOS EN LA AUTENTICACIÓN
  ---------------------------------------------------------- */

  escucharCambiosAuth(callback) {
    if (!clienteSupabase) return null;

    const { data } = clienteSupabase.auth.onAuthStateChange(
      (evento, sesion) => {
        callback(evento, sesion);
      }
    );

    return data.subscription;
  },

  /* ----------------------------------------------------------
  RECUPERAR CONTRASEÑA
  ---------------------------------------------------------- */

  async recuperarPassword(email) {
    if (!clienteSupabase) {
      return {
        exito: false,
        mensaje: 'No hay conexión con Supabase.'
      };
    }

    const { error } = await clienteSupabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: URL_REDIRECCION
      }
    );

    if (error) {
      console.error('Error al solicitar recuperación:', error.message);

      return {
        exito: false,
        mensaje: error.message
      };
    }

    return {
      exito: true,
      mensaje: 'Si el correo está registrado, recibirás las instrucciones para recuperar tu contraseña.'
    };
  },

  /* ----------------------------------------------------------
  ACTUALIZAR CONTRASEÑA
  ---------------------------------------------------------- */

  async actualizarPassword(nuevaPassword) {
    if (!clienteSupabase) {
      return {
        exito: false,
        mensaje: 'No hay conexión con Supabase.'
      };
    }

    const { error } = await clienteSupabase.auth.updateUser({
      password: nuevaPassword
    });

    if (error) {
      console.error('Error al actualizar contraseña:', error.message);

      return {
        exito: false,
        mensaje: error.message
      };
    }

    return {
      exito: true,
      mensaje: 'La contraseña se actualizó correctamente.'
    };
  },

  /* 3. DATOS DEL EMPRENDIMIENTO */

  /* ----------------------------------------------------------
  OBTENER EL EMPRENDIMIENTO DEL USUARIO CONECTADO
  ---------------------------------------------------------- */

  async obtenerEmprendimiento() {
    if (!clienteSupabase) return null;

    const usuario = await this.obtenerUsuario();

    if (!usuario) {
      emprendimientoActual = null;
      return null;
    }

    const { data, error } = await clienteSupabase
      .from('emprendimientos')
      .select('*')
      .eq('propietario_id', usuario.id)
      .maybeSingle();

    if (error) {
      console.error('Error al obtener emprendimiento:', error.message);
      return null;
    }

    emprendimientoActual = data;

    return data;
  },

  /* ----------------------------------------------------------
  ESTABLECER EL EMPRENDIMIENTO ACTIVO
  ---------------------------------------------------------- */

  establecerEmprendimiento(emprendimiento) {
    emprendimientoActual = emprendimiento || null;
  },

  /* ----------------------------------------------------------
  OBTENER EL EMPRENDIMIENTO ACTIVO
  ---------------------------------------------------------- */

  obtenerEmprendimientoActual() {
    return emprendimientoActual;
  },

  /* 4. GESTIÓN DE PRODUCTOS */

  /* ----------------------------------------------------------
  OBTENER PRODUCTOS
  ---------------------------------------------------------- */

  async obtenerProductos() {
    if (!clienteSupabase || !emprendimientoActual) return [];

    const { data, error } = await clienteSupabase
      .from('productos')
      .select('*')
      .eq('emprendimiento_id', emprendimientoActual.id)
      .order('id', { ascending: false });

    if (error) {
      console.error('Error al obtener productos:', error.message);
      return [];
    }

    return data || [];
  },

  /* ----------------------------------------------------------
  INSERTAR PRODUCTO
  ---------------------------------------------------------- */

  async insertarProducto(nuevoProducto) {
    if (!clienteSupabase || !emprendimientoActual) {
      return {
        exito: false,
        mensaje: 'No hay un emprendimiento activo.'
      };
    }

    const productoConEmprendimiento = {
      ...nuevoProducto,
      emprendimiento_id: emprendimientoActual.id
    };

    const { data, error } = await clienteSupabase
      .from('productos')
      .insert([productoConEmprendimiento])
      .select()
      .single();

    if (error) {
      console.error('Error al guardar producto:', error.message);

      return {
        exito: false,
        mensaje: error.message
      };
    }

    return {
      exito: true,
      data: data
    };
  },

  /* ----------------------------------------------------------
  ELIMINAR PRODUCTO
  ---------------------------------------------------------- */

  async eliminarProducto(id) {
    if (!clienteSupabase || !emprendimientoActual) return false;

    const { error } = await clienteSupabase
      .from('productos')
      .delete()
      .eq('id', id)
      .eq('emprendimiento_id', emprendimientoActual.id);

    if (error) {
      console.error('Error al eliminar producto:', error.message);
      return false;
    }

    return true;
  },

  /* ----------------------------------------------------------
  ACTUALIZAR STOCK
  ---------------------------------------------------------- */

  async actualizarStockProducto(id, nuevoStock) {
    if (!clienteSupabase || !emprendimientoActual) return false;

    const { error } = await clienteSupabase
      .from('productos')
      .update({ stock: nuevoStock })
      .eq('id', id)
      .eq('emprendimiento_id', emprendimientoActual.id);

    if (error) {
      console.error('Error al actualizar stock:', error.message);
      return false;
    }

    return true;
  },

  /* 5. GESTIÓN DE VENTAS */

  /* ----------------------------------------------------------
  REGISTRAR VENTA ATÓMICA
  Descuenta stock y registra la venta en una sola operación.
  ---------------------------------------------------------- */

  async registrarVentaAtomica(datosVenta) {
    if (!clienteSupabase || !emprendimientoActual) {
      return {
        exito: false,
        mensaje: 'No hay un emprendimiento activo.'
      };
    }

    const productoId = Number(datosVenta?.producto_id);
    const cantidad = Number(datosVenta?.cantidad);

    if (
      !Number.isSafeInteger(productoId) ||
      productoId <= 0 ||
      !Number.isSafeInteger(cantidad) ||
      cantidad <= 0
    ) {
      return {
        exito: false,
        mensaje: 'Los datos de la venta no son válidos.'
      };
    }

    const { data, error } = await clienteSupabase.rpc('registrar_venta', {
      p_producto_id: productoId,
      p_cantidad: cantidad
    });

    if (error) {
      console.error('Error al registrar venta:', error.message);

      return {
        exito: false,
        mensaje: error.message || 'No se pudo registrar la venta.'
      };
    }

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      data.stock_restante === undefined ||
      !Number.isFinite(Number(data.stock_restante))
    ) {
      console.error('Respuesta inesperada de registrar_venta:', data);

      return {
        exito: false,
        mensaje: 'Supabase devolvió una respuesta inesperada al registrar la venta.'
      };
    }

    return {
      exito: true,
      data: data
    };
  },

  /* ----------------------------------------------------------
  REGISTRAR VENTA DIRECTAMENTE
  Se conserva por compatibilidad.
  Para nuevas ventas utilizar registrarVentaAtomica.
  ---------------------------------------------------------- */

  async registrarVentaBD(datosVenta) {
    if (!clienteSupabase || !emprendimientoActual) return false;

    const ventaConEmprendimiento = {
      ...datosVenta,
      emprendimiento_id: emprendimientoActual.id
    };

    const { error } = await clienteSupabase
      .from('ventas')
      .insert([ventaConEmprendimiento]);

    if (error) {
      console.error('Error al registrar venta:', error.message);
      return false;
    }

    return true;
  },

  /* ----------------------------------------------------------
  OBTENER TOTAL DE VENTAS DEL DÍA
  ---------------------------------------------------------- */

  async obtenerVentasHoyTotal() {
    if (!clienteSupabase || !emprendimientoActual) return 0;

    // Se utilizan fechas locales para respetar el día del usuario.
    const ahora = new Date();

    const inicio = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate()
    );

    const fin = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate() + 1
    );

    const formatoLocal = (fecha) => {
      const año = fecha.getFullYear();
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const dia = String(fecha.getDate()).padStart(2, '0');
      const hora = String(fecha.getHours()).padStart(2, '0');
      const minutos = String(fecha.getMinutes()).padStart(2, '0');
      const segundos = String(fecha.getSeconds()).padStart(2, '0');

      return `${año}-${mes}-${dia}T${hora}:${minutos}:${segundos}`;
    };

    const { data, error } = await clienteSupabase
      .from('ventas')
      .select('total_venta')
      .eq('emprendimiento_id', emprendimientoActual.id)
      .gte('fecha', formatoLocal(inicio))
      .lt('fecha', formatoLocal(fin));

    if (error) {
      console.error('Error al obtener ventas del día:', error.message);
      return 0;
    }

    return (data || []).reduce(
      (total, venta) => total + Number(venta.total_venta || 0),
      0
    );
  }

};

/* ==========================================================================
FIN DE CONEXION.JS
========================================================================== */
