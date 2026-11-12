/* ==========================================================================
   REPOSITORIO.JS - Capa de Lógica de Negocio y Estado
   ========================================================================== */

const RepositorioNegocio = {
  // Lista en memoria local para mantener la app ágil
  productos: [],

  // Cargar productos desde Supabase (o inicializar vacío)
  async inicializar() {
    console.log('🔄 Sincronizando repositorio de datos...');
    this.productos = await ConexionDB.obtenerProductos();
    return this.productos;
  },

  // Registrar un nuevo producto con validaciones de negocio
  async agregarProducto(datosFormulario) {
    // 1. Validar que los datos numéricos sean correctos
    const costo = parseFloat(datosFormulario.precio_costo);
    const venta = parseFloat(datosFormulario.precio_venta);
    const stockInicial = parseInt(datosFormulario.stock);
    
    if (venta <= costo) {
      console.warn('⚠️ Advertencia: El precio de venta es menor o igual al costo.');
    }

    const nuevoItem = {
      nombre: datosFormulario.nombre,
      categoria: datosFormulario.categoria,
      precio_costo: costo,
      precio_venta: venta,
      stock: stockInicial
    };

    // 2. Insertar en Supabase a través de tu clase de conexión
    const resultado = await ConexionDB.insertarProducto(nuevoItem);

    if (resultado.exito) {
      // 3. Sincronizar el repositorio local para actualizar la interfaz
      await this.inicializar();
      return { exito: true };
    } else {
      return { exito: false, mensaje: resultado.mensaje };
    }
  },

  // Eliminar un producto por ID y refrescar la lista
  async eliminarProducto(id) {
    console.log(`🗑️ Eliminando producto ID: ${id}...`);
    const exito = await ConexionDB.eliminarProducto(id);

    if (exito) {
      // Sincronizar el estado local
      await this.inicializar();
      return true;
    }
    return false;
  },

  // Calcular métricas rápidas para el Dashboard
  obtenerMetricas() {
    const totalProductos = this.productos.length;
    
    // Contar cuántos productos tienen stock menor o igual a 3 (alerta de stock bajo)
    const stockBajo = this.productos.filter(p => p.stock <= 3).length;

    return {
      ventasHoy: 0, // Se actualizará al integrar el módulo de ventas
      totalProductos,
      stockBajo
    };
  }
};
