/* ==========================================================================
   REPOSITORIO.JS - Lógica de Negocio y Estado Central
   ========================================================================== */

const RepositorioNegocio = {
  productos: [],
  ventasHoy: 0,

  // Inicializar cargando los productos desde Supabase
  async inicializar() {
    console.log('🔄 Sincronizando repositorio de datos...');
    this.productos = await ConexionDB.obtenerProductos();
    await this.calcularVentasHoy();
  },

  // Agregar un producto nuevo
  async agregarProducto(datosProducto) {
    const resultado = await ConexionDB.insertarProducto(datosProducto);
    
    if (resultado.exito) {
      this.productos.unshift(resultado.data); // Añadir al inicio del array local
      return { exito: true };
    } else {
      return { exito: false, mensaje: resultado.mensaje };
    }
  },

  // Eliminar un producto
  async eliminarProducto(id) {
    const exitoRemoto = await ConexionDB.eliminarProducto(id);
    
    if (exitoRemoto) {
      this.productos = this.productos.filter(p => p.id !== id);
      return true;
    }
    return false;
  },

  // Registrar una venta, descontar stock y sumar ingresos
  async registrarVenta(productoId, cantidadVendida) {
    // 1. Buscar el producto en la lista local
    const producto = this.productos.find(p => p.id === productoId);
    if (!producto) {
      return { exito: false, mensaje: 'El producto seleccionado no existe.' };
    }

    // 2. Validar que haya suficiente stock
    if (producto.stock < cantidadVendida) {
      return { exito: false, mensaje: `Stock insuficiente. Solo quedan ${producto.stock} unidades.` };
    }

    // 3. Calcular el total de la venta
    const totalVenta = producto.precio_venta * cantidadVendida;
    const nuevoStock = producto.stock - cantidadVendida;

    // 4. Actualizar el stock del producto en Supabase
    const stockActualizado = await ConexionDB.actualizarStockProducto(productoId, nuevoStock);
    if (!stockActualizado) {
      return { exito: false, mensaje: 'No se pudo actualizar el stock en la base de datos.' };
    }

    // 5. Registrar la transacción en la tabla 'ventas' de Supabase
    const ventaRegistrada = await ConexionDB.registrarVentaBD({
      producto_id: producto.id,
      nombre_producto: producto.nombre,
      cantidad: cantidadVendida,
      total_venta: totalVenta
    });

    if (!ventaRegistrada) {
      return { exito: false, mensaje: 'Se descontó el stock pero falló el registro de la venta.' };
    }

    // 6. Actualizar el estado local
    producto.stock = nuevoStock;
    await this.calcularVentasHoy();

    return { exito: true };
  },

  // Calcular el total de ventas del día actual
  async calcularVentasHoy() {
    this.ventasHoy = await ConexionDB.obtenerVentasHoyTotal();
  },

  // Obtener métricas para el Dashboard
  obtenerMetricas() {
    const totalProductos = this.productos.length;
    // Consideramos stock bajo si tiene 3 o menos unidades
    const stockBajo = this.productos.filter(p => p.stock <= 3).length;

    return {
      totalProductos,
      stockBajo,
      ventasHoy: this.ventasHoy
    };
  }
};
