/* ==========================================================================
   CONEXION.JS — CAPA DE CONEXIÓN A SUPABASE
   MiControl | Autenticación y acceso a datos
   ========================================================================== */

/* 1. CONFIGURACIÓN DE SUPABASE */

const SUPABASE_URL = 'https://lmqgxqhwujrtglyiiyjr.supabase.co';
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

/* 2. AUTENTICACIÓN */

const ConexionDB = {

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
      data,
      mensaje: 'Registro realizado. Revisá tu correo para confirmar la cuenta.'
    };
  },

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
      data
    };
  },

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

  async obtenerSesion() {
    if (!clienteSupabase) return null;

    const { data, error } = await clienteSupabase.auth.getSession();

    if (error) {
      console.error('Error al obtener sesión:', error.message);
      return null;
    }

    return data.session;
  },

  async obtenerUsuario() {
    if (!clienteSupabase) return null;

    const { data, error } = await clienteSupabase.auth.getUser();

    if (error) {
      console.error('Error al obtener usuario:', error.message);
      return null;
    }

    return data.user;
  },

  escucharCambiosAuth(callback) {
    if (!clienteSupabase) return null;

    const { data } = clienteSupabase.auth.onAuthStateChange(
      (evento, sesion) => callback(evento, sesion)
    );

    return data.subscription;
  },

  async recuperarPassword(email) {
    if (!clienteSupabase) {
      return {
        exito: false,
        mensaje: 'No hay conexión con Supabase.'
      };
    }

    const { error } = await clienteSupabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: URL_REDIRECCION }
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

  establecerEmprendimiento(emprendimiento) {
    emprendimientoActual = emprendimiento || null;
  },

  obtenerEmprendimientoActual() {
    return emprendimientoActual;
  },

  async actualizarNombreEmprendimiento(nuevoNombre) {
    if (!clienteSupabase || !emprendimientoActual) {
      return {
        exito: false,
        mensaje: 'No hay un emprendimiento activo.'
      };
    }

    if (typeof nuevoNombre !== 'string') {
      return {
        exito: false,
        mensaje: 'El nombre ingresado no es válido.'
      };
    }

    const nombre = nuevoNombre.trim();

    if (!nombre || nombre.length > 100) {
      return {
        exito: false,
        mensaje: 'El nombre debe tener entre 1 y 100 caracteres.'
      };
    }

    const usuario = await this.obtenerUsuario();

    if (!usuario) {
      return {
        exito: false,
        mensaje: 'No hay una sesión activa.'
      };
    }

    const { data, error } = await clienteSupabase
      .from('emprendimientos')
      .update({ nombre })
      .eq('id', emprendimientoActual.id)
      .eq('propietario_id', usuario.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error al actualizar emprendimiento:', error.message);

      return {
        exito: false,
        mensaje: 'No se pudo actualizar el nombre del emprendimiento.'
      };
    }

    emprendimientoActual = data;

    return {
      exito: true,
      data,
      mensaje: 'El nombre del emprendimiento se actualizó correctamente.'
    };
  },

  /* 4. GESTIÓN DE PRODUCTOS */

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
      data
    };
  },

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
      data
    };
  },

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

  /* 6. CONSULTAR HISTORIAL DE VENTAS ENTRE DOS FECHAS */

  async obtenerVentasPeriodo(desde, hasta) {
    if (!clienteSupabase || !emprendimientoActual) {
      return {
        exito: false,
        mensaje: 'No hay un emprendimiento activo.',
        data: []
      };
    }

    const esFechaValida = (valor) => {
      if (
        typeof valor !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(valor)
      ) {
        return false;
      }

      const [anio, mes, dia] = valor.split('-').map(Number);
      const fecha = new Date(Date.UTC(anio, mes - 1, dia));

      return (
        fecha.getUTCFullYear() === anio &&
        fecha.getUTCMonth() === mes - 1 &&
        fecha.getUTCDate() === dia
      );
    };

    if (
      !esFechaValida(desde) ||
      !esFechaValida(hasta) ||
      desde > hasta
    ) {
      return {
        exito: false,
        mensaje: 'El período seleccionado no es válido.',
        data: []
      };
    }

    const [anio, mes, dia] = hasta.split('-').map(Number);

    const diaPosterior = new Date(
      Date.UTC(anio, mes - 1, dia + 1)
    );

    const hastaExclusivo = [
      diaPosterior.getUTCFullYear(),
      String(diaPosterior.getUTCMonth() + 1).padStart(2, '0'),
      String(diaPosterior.getUTCDate()).padStart(2, '0')
    ].join('-');

    const { data, error } = await clienteSupabase
      .from('ventas')
      .select('id, producto_id, nombre_producto, cantidad, total_venta, fecha')
      .eq('emprendimiento_id', emprendimientoActual.id)
      .gte('fecha', `${desde}T00:00:00`)
      .lt('fecha', `${hastaExclusivo}T00:00:00`)
      .order('fecha', { ascending: false });

    if (error) {
      console.error('Error al obtener historial de ventas:', error.message);

      return {
        exito: false,
        mensaje: 'No se pudo cargar el historial de ventas.',
        data: []
      };
    }

    return {
      exito: true,
      data: data || []
    };
  },

  /* ALIAS PARA CONSULTAR REPORTES */

  async obtenerReporteVentas(desde, hasta) {
    return await this.obtenerVentasPeriodo(desde, hasta);
  },

  /* 7. OBTENER TOTAL DE VENTAS DEL DÍA */

  async obtenerVentasHoyTotal() {
    if (!clienteSupabase || !emprendimientoActual) return 0;

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
