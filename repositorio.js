/* ==========================================================================
   REPOSITORIO.JS - Lógica de Negocio y Estado Central
   ========================================================================== */

const RepositorioNegocio = {
  productos: [],
  ventasHoy: 0,

  async inicializar() {
    console.log('🔄 Sincronizando repositorio de datos...');
    this.productos = await ConexionDB.obtenerProductos();
    await this.calcularVentasHoy();
  },

  async agregarProducto(datosProducto) {
    const resultado = await ConexionDB.insertarProducto(datosProducto);
    
    if (resultado.exito) {
      this.productos.unshift(resultado.data);
      return { exito: true };
    } else {
      return { exito: false, mensaje: resultado.mensaje };
    }
  },

  async eliminarProducto(id) {
    const exitoRemoto = await ConexionDB.eliminarProducto(id);
    
    if (exitoRemoto) {
      this.productos = this.productos.filter(p => p.id !== id);
      return true;
    }
    return false;
  },

  async registrarVenta(productoId, cantidadVendida) {
    const producto = this.productos.find(p => p.id === productoId);
    if (!producto) {
      return { exito: false, mensaje: 'El producto seleccionado no existe.' };
    }

    if (producto.stock < cantidadVendida) {
      return { exito: false, mensaje: `Stock insuficiente. Solo quedan ${producto.stock} unidades.` };
    }

    const totalVenta = producto.precio_venta * cantidadVendida;
    const nuevoStock = producto.stock - cantidadVendida;

    const stockActualizado = await ConexionDB.actualizarStockProducto(productoId, nuevoStock);
    if (!stockActualizado) {
      return { exito: false, mensaje: 'No se pudo actualizar el stock en la base de datos.' };
    }

    const ventaRegistrada = await ConexionDB.registrarVentaBD({
      producto_id: producto.id,
      nombre_producto: producto.nombre,
      cantidad: cantidadVendida,
      total_venta: totalVenta
    });

    if (!ventaRegistrada) {
      return { exito: false, mensaje: 'Se descontó el stock pero falló el registro de la venta.' };
    }

    producto.stock = nuevoStock;
    await this.calcularVentasHoy();

    return { exito: true };
  },

  async calcularVentasHoy() {
    this.ventasHoy = await ConexionDB.obtenerVentasHoyTotal();
  },

  obtenerMetricas() {
    const totalProductos = this.productos.length;
    const stockBajo = this.productos.filter(p => p.stock <= 3).length;

    return {
      totalProductos,
      stockBajo,
      ventasHoy: this.ventasHoy
    };
  }
};
