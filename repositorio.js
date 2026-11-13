/* ==========================================================================
   REPOSITORIO.JS - Lógica de Negocio y Estado Central
   MiControl | Gestión de Emprendimientos
   ========================================================================== */

const RepositorioNegocio = {

  productos: [],
  ventasHoy: 0,

  // ------------------------------------------------------------------------
  // INICIALIZACIÓN DEL REPOSITORIO
  // ------------------------------------------------------------------------

  async inicializar() {
    try {
      console.log('🔄 Sincronizando repositorio de datos...');

      this.productos = await ConexionDB.obtenerProductos();

      await this.calcularVentasHoy();

      console.log('✅ Repositorio sincronizado correctamente.');

      return { exito: true };

    } catch (error) {
      console.error('Error al inicializar el repositorio:', error);

      this.productos = [];
      this.ventasHoy = 0;

      return {
        exito: false,
        mensaje: 'No se pudieron cargar los datos del emprendimiento.'
      };
    }
  },

  // ------------------------------------------------------------------------
  // AGREGAR PRODUCTO
  // ------------------------------------------------------------------------

  async agregarProducto(datosProducto) {
    try {
      const resultado = await ConexionDB.insertarProducto(datosProducto);

      if (!resultado || !resultado.exito) {
        return {
          exito: false,
          mensaje: resultado?.mensaje || 'No se pudo guardar el producto.'
        };
      }

      this.productos.unshift(resultado.data);

      return { exito: true };

    } catch (error) {
      console.error('Error al agregar producto:', error);

      return {
        exito: false,
        mensaje: 'Ocurrió un error al guardar el producto.'
      };
    }
  },

  // ------------------------------------------------------------------------
  // ELIMINAR PRODUCTO
  // ------------------------------------------------------------------------

  async eliminarProducto(id) {
    try {
      const idProducto = Number(id);

      if (!Number.isSafeInteger(idProducto) || idProducto <= 0) {
        return false;
      }

      const exitoRemoto = await ConexionDB.eliminarProducto(idProducto);

      if (exitoRemoto) {
        this.productos = this.productos.filter(
          producto => Number(producto.id) !== idProducto
        );

        return true;
      }

      return false;

    } catch (error) {
      console.error('Error al eliminar producto:', error);
      return false;
    }
  },

  // ------------------------------------------------------------------------
  // REGISTRAR VENTA
  // ------------------------------------------------------------------------

  async registrarVenta(productoId, cantidadVendida) {
    try {
      const idProducto = Number(productoId);
      const cantidad = Number(cantidadVendida);

      // Validar identificación del producto.
      if (!Number.isSafeInteger(idProducto) || idProducto <= 0) {
        return {
          exito: false,
          mensaje: 'El producto seleccionado no es válido.'
        };
      }

      // Validar cantidad.
      if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
        return {
          exito: false,
          mensaje: 'Ingresá una cantidad válida, mayor que cero.'
        };
      }

      // Buscar producto en el repositorio.
      const producto = this.productos.find(
        p => Number(p.id) === idProducto
      );

      if (!producto) {
        return {
          exito: false,
          mensaje: 'El producto seleccionado no existe.'
        };
      }

      // Verificar disponibilidad de stock.
      if (Number(producto.stock) < cantidad) {
        return {
          exito: false,
          mensaje: `Stock insuficiente. Solo quedan ${producto.stock} unidades.`
        };
      }

      // Calcular importe y nuevo stock.
      const totalVenta = Number(producto.precio_venta) * cantidad;
      const nuevoStock = Number(producto.stock) - cantidad;

      if (!Number.isFinite(totalVenta) || totalVenta <= 0) {
        return {
          exito: false,
          mensaje: 'No se pudo calcular el importe de la venta.'
        };
      }

      // Actualizar stock en Supabase.
      const stockActualizado = await ConexionDB.actualizarStockProducto(
        idProducto,
        nuevoStock
      );

      if (!stockActualizado) {
        return {
          exito: false,
          mensaje: 'No se pudo actualizar el stock en la base de datos.'
        };
      }

      // Registrar la venta.
      const ventaRegistrada = await ConexionDB.registrarVentaBD({
        producto_id: idProducto,
        nombre_producto: producto.nombre,
        cantidad: cantidad,
        total_venta: totalVenta
      });

      if (!ventaRegistrada) {
        return {
          exito: false,
          mensaje: 'Se actualizó el stock, pero no se pudo registrar la venta. Es necesario revisar esta operación.'
        };
      }

      // Actualizar el estado local.
      producto.stock = nuevoStock;

      await this.calcularVentasHoy();

      return { exito: true };

    } catch (error) {
      console.error('Error al registrar venta:', error);

      return {
        exito: false,
        mensaje: 'Ocurrió un error inesperado al registrar la venta.'
      };
    }
  },

  // ------------------------------------------------------------------------
  // CALCULAR VENTAS DEL DÍA
  // ------------------------------------------------------------------------

  async calcularVentasHoy() {
    try {
      this.ventasHoy = await ConexionDB.obtenerVentasHoyTotal();

      return this.ventasHoy;

    } catch (error) {
      console.error('Error al calcular ventas del día:', error);

      this.ventasHoy = 0;

      return 0;
    }
  },

  // ------------------------------------------------------------------------
  // OBTENER MÉTRICAS DEL EMPRENDIMIENTO
  // ------------------------------------------------------------------------

  obtenerMetricas() {
    const totalProductos = this.productos.length;

    const stockBajo = this.productos.filter(
      producto => Number(producto.stock) <= 3
    ).length;

    return {
      totalProductos,
      stockBajo,
      ventasHoy: this.ventasHoy
    };
  }

};
