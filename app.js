/* ==========================================================================
   APP.JS - Controlador Principal de la Interfaz y Eventos
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Aplicación iniciada y DOM cargado.');

  // 1. Inicializar datos al cargar la página (Descarga productos y calcula ventas)
  await RepositorioNegocio.inicializar();
  actualizarInterfaz();

  // 2. Escuchar el envío del formulario para crear un producto
  const formProducto = document.getElementById('form-producto');
  if (formProducto) {
    formProducto.addEventListener('submit', async (e) => {
      e.preventDefault();

      const datos = {
        nombre: document.getElementById('nombre').value,
        categoria: document.getElementById('categoria').value,
        precio_costo: parseFloat(document.getElementById('precio-costo').value) || 0,
        precio_venta: parseFloat(document.getElementById('precio-venta').value) || 0,
        stock: parseInt(document.getElementById('stock').value) || 0
      };

      const resultado = await RepositorioNegocio.agregarProducto(datos);

      if (resultado.exito) {
        formProducto.reset();
        actualizarInterfaz();
        alert('✅ ¡Producto guardado con éxito!');
      } else {
        alert(`❌ Error: ${resultado.mensaje}`);
      }
    });
  }

  // 3. Escuchar el envío del formulario para registrar una venta
  const formVenta = document.getElementById('form-venta');
  if (formVenta) {
    formVenta.addEventListener('submit', async (e) => {
      e.preventDefault();

      const productoId = parseInt(document.getElementById('venta-producto-id').value);
      const cantidadVendida = parseInt(document.getElementById('venta-cantidad').value);

      if (!productoId || !cantidadVendida) {
        alert('Por favor, selecciona un producto y una cantidad válida.');
        return;
      }

      // Llamamos a la función de negocio para procesar la venta
      const resultado = await RepositorioNegocio.registrarVenta(productoId, cantidadVendida);

      if (resultado.exito) {
        formVenta.reset();
        actualizarInterfaz();
        alert('✅ ¡Venta registrada y stock actualizado con éxito!');
      } else {
        alert(`❌ Error al registrar venta: ${resultado.mensaje}`);
      }
    });
  }
});

// Función para actualizar la tabla, métricas y selector de ventas en la pantalla
function actualizarInterfaz() {
  // A. Actualizar métricas del Dashboard
  const metricas = RepositorioNegocio.obtenerMetricas();
  
  document.getElementById('metric-productos').textContent = metricas.totalProductos;
  document.getElementById('metric-stock-alerta').textContent = metricas.stockBajo;
  document.getElementById('metric-ventas').textContent = `$${metricas.ventasHoy.toFixed(2)}`;

  // B. Renderizar tabla de inventario de productos
  const tbody = document.getElementById('tabla-productos-body');
  if (tbody) {
    const productos = RepositorioNegocio.productos;

    if (productos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No hay productos registrados aún.</td></tr>`;
    } else {
      tbody.innerHTML = '';
      productos.forEach(p => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td><strong>${p.nombre}</strong></td>
          <td>${p.categoria}</td>
          <td>$${Number(p.precio_costo).toFixed(2)}</td>
          <td>$${Number(p.precio_venta).toFixed(2)}</td>
          <td>${p.stock} un.</td>
          <td>
            <button onclick="manejarEliminarProducto(${p.id})" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">
              Eliminar
            </button>
          </td>
        `;
        tbody.appendChild(fila);
      });
    }
  }

  // C. Llenar el selector de productos en el formulario de Ventas
  const selectVentas = document.getElementById('venta-producto-id');
  if (selectVentas) {
    selectVentas.innerHTML = `<option value="">-- Selecciona un producto --</option>`;
    RepositorioNegocio.productos.forEach(p => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = `${p.nombre} (Stock: ${p.stock} - Venta: $${p.precio_venta})`;
      selectVentas.appendChild(option);
    });
  }
}

// Función para manejar la eliminación de un producto
async function manejarEliminarProducto(id) {
  const confirmar = confirm('¿Estás seguro de que deseas eliminar este producto?');
  
  if (confirmar) {
    const exito = await RepositorioNegocio.eliminarProducto(id);
    
    if (exito) {
      alert('✅ Producto eliminado correctamente.');
      actualizarInterfaz();
    } else {
      alert('❌ Ocurrió un error al intentar eliminar el producto.');
    }
  }
}

// 🌟 FUNCIÓN DE NAVEGACIÓN SPA (Cambiar entre Dashboard, Productos y Ventas)
function cambiarVista(nombreVista, botonElemento) {
  // 1. Ocultar todas las secciones de vista
  const secciones = document.querySelectorAll('.vista-seccion');
  secciones.forEach(seccion => {
    seccion.style.display = 'none';
  });

  // 2. Mostrar únicamente la sección seleccionada
  const seccionActiva = document.getElementById(`vista-${nombreVista}`);
  if (seccionActiva) {
    seccionActiva.style.display = 'block';
  }

  // 3. Actualizar los estilos activos en los botones del menú lateral
  const botonesMenu = document.querySelectorAll('.menu-lateral button');
  botonesMenu.forEach(btn => btn.classList.remove('activo'));
  
  if (botonElemento) {
    botonElemento.classList.add('activo');
  }
}
