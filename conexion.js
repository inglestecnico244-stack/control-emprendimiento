/* ==========================================================================
   CONEXION.JS - Capa de Conexión a Supabase y Asistente IA
   ========================================================================== */

// 1. TUS CREDENCIALES DE SUPABASE
const SUPABASE_URL = 'https://lmqgxqhwujrtglyiiyjr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CePJYdnQu8w-H9G3wjDhJw_RGWryimX';

// Inicialización del cliente de Supabase
let clienteSupabase = null;

if (typeof supabase !== 'undefined' && SUPABASE_URL.includes('https://')) {
  clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('✅ Supabase conectado correctamente.');
} else {
  console.warn('⚠️ Supabase pendiente de credenciales reales.');
}

// 2. MÉTODOS DE CONEXIÓN CON LA BASE DE DATOS (Supabase / PostgreSQL)
const ConexionDB = {

  // Obtener productos desde la tabla 'productos' en Supabase
  async obtenerProductos() {
    if (!clienteSupabase) return [];

    const { data, error } = await clienteSupabase
      .from('productos')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      console.error('Error al obtener productos de Supabase:', error.message);
      return [];
    }
    return data;
  },

  // Insertar un nuevo producto en la tabla 'productos' de Supabase
  async insertarProducto(nuevoProducto) {
    if (!clienteSupabase) {
      return { exito: false, mensaje: 'Supabase no está conectado. Configura tus credenciales.' };
    }

    const { data, error } = await clienteSupabase
      .from('productos')
      .insert([nuevoProducto])
      .select();

    if (error) {
      console.error('Error al guardar en Supabase:', error.message);
      return { exito: false, mensaje: error.message };
    }
    
    return { exito: true, data: data[0] };
  },

  // Eliminar un producto por ID en Supabase
  async eliminarProducto(id) {
    if (!clienteSupabase) return false;

    const { error } = await clienteSupabase
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error al eliminar en Supabase:', error.message);
      return false;
    }
    return true;
  }
};

// 3. MÉTODOS DE CONEXIÓN CON EL ASISTENTE IA (Vía Edge Functions)
const ConexionIA = {
  async consultarAsistente(prompt, contextoNegocio = {}) {
    try {
      if (!clienteSupabase) {
        return '💡 **Asistente:** Conecta Supabase para habilitar las consultas inteligentes en tiempo real.';
      }

      // Llamada oficial a una Supabase Edge Function para IA de forma segura
      const { data, error } = await clienteSupabase.functions.invoke('asistente-ia', {
        body: { prompt, contexto: contextoNegocio }
      });

      if (error) throw error;
      return data.respuesta;

    } catch (error) {
      console.error('Error al conectar con la IA:', error);
      return 'Ocurrió un error al procesar tu consulta con el asistente.';
    }
  }
};
// Actualizar el stock de un producto después de una venta
  async actualizarStockProducto(id, nuevoStock) {
    if (!clienteSupabase) return false;

    const { error } = await clienteSupabase
      .from('productos')
      .update({ stock: nuevoStock })
      .eq('id', id);

    if (error) {
      console.error('Error al actualizar stock:', error.message);
      return false;
    }
    return true;
  },

  // Registrar una venta en la tabla 'ventas'
  async registrarVentaBD(datosVenta) {
    if (!clienteSupabase) return false;

    const { error } = await clienteSupabase
      .from('ventas')
      .insert([datosVenta]);

    if (error) {
      console.error('Error al registrar venta en BD:', error.message);
      return false;
    }
    return true;
  },

  // Obtener la suma total de las ventas del día
  async obtenerVentasHoyTotal() {
    if (!clienteSupabase) return 0;

    // Obtenemos todas las ventas (para una demo académica simple y robusta)
    const { data, error } = await clienteSupabase
      .from('ventas')
      .select('total_venta');

    if (error) {
      console.error('Error al obtener ventas:', error.message);
      return 0;
    }

    // Sumamos todos los totales de venta
    let sumaTotal = 0;
    if (data && data.length > 0) {
      sumaTotal = data.reduce((acc, item) => acc + Number(item.total_venta), 0);
    }
    return sumaTotal;
  }

  
 
