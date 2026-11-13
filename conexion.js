/* ==========================================================================
   CONEXION.JS - Capa de Conexión a Supabase
   ========================================================================== */

const SUPABASE_URL = 'https://lmqgxqhwujrtglyiiyjr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CePJYdnQu8w-H9G3wjDhJw_RGWryimX';

let clienteSupabase = null;

if (typeof supabase !== 'undefined' && SUPABASE_URL.includes('https://')) {
  clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('✅ Supabase conectado correctamente.');
} else {
  console.warn('⚠️ Supabase pendiente de credenciales reales.');
}

const ConexionDB = {
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

  async insertarProducto(nuevoProducto) {
    if (!clienteSupabase) {
      return { exito: false, mensaje: 'Supabase no está conectado.' };
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
  },

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

  async obtenerVentasHoyTotal() {
    if (!clienteSupabase) return 0;

    const { data, error } = await clienteSupabase
      .from('ventas')
      .select('total_venta');

    if (error) {
      console.error('Error al obtener ventas:', error.message);
      return 0;
    }

    let sumaTotal = 0;
    if (data && data.length > 0) {
      sumaTotal = data.reduce((acc, item) => acc + Number(item.total_venta), 0);
    }
    return sumaTotal;
  }
};
