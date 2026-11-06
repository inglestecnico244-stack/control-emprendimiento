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
    const costo = parseFloat(datosFormulario.precioCosto);
    const venta = parseFloat(datosFormulario.precioVenta);
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

    // 2. Guardar en Supabase a través de conexion.js
    const resultadoDB = await ConexionDB.guardarProducto(nuevoItem);

    if (resultadoDB) {
      // Agregar al arreglo local
      this.productos.unshift(resultadoDB);
      return { exito: true, producto: resultadoDB };
    }

    return { exito: false, mensaje: 'No se pudo guardar el producto en la base de datos.' };
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