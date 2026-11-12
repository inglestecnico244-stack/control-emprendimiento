/* ==========================================================================
   APP.JS - Controlador Principal de la Interfaz y Eventos
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Aplicación iniciada y DOM cargado.');

  // 1. Inicializar datos al cargar la página
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

  // 3. Escuchar el botón del Asistente IA
  const btnConsultarIA = document.getElementById('btn-consultar-ia');
  if (btnConsultarIA) {
    btnConsultarIA.addEventListener('click', async () => {
      const promptInput = document.getElementById('prompt-ia');
      const contenedorRespuesta = document.getElementById('respuesta-ia');
      const textoRespuesta = contenedorRespuesta.querySelector('.ia-response-text');

      const textoPrompt = promptInput.value.trim();
      if (!textoPrompt) {
        alert('Por favor, escribe una consulta para el asistente.');
        return;
      }

      // Mostrar estado de carga
      textoRespuesta.innerHTML = '⏳ Pensando respuesta...';
      contenedorRespuesta.classList.remove('hidden');

      // Obtener la lista actual de productos del negocio para dársela como contexto a la IA
      const productosActuales = RepositorioNegocio.productos;

      // Consultar al asistente pasándole el texto y el inventario actual
      const respuestaIA = await ConexionIA.consultarAsistente(textoPrompt, productosActuales);
      
      // Renderizar respuesta
      textoRespuesta.innerHTML = respuestaIA;
    });
  }
});

// Función para actualizar la tabla y las métricas en la pantalla
function actualizarInterfaz() {
  // A. Actualizar métricas del Dashboard
  const metricas = RepositorioNegocio.obtenerMetricas();
  
  document.getElementById('metric-productos').textContent = metricas.totalProductos;
  document.getElementById('metric-stock-alerta').textContent = metricas.stockBajo;

  // B. Renderizar tabla de productos
  const tbody = document.getElementById('tabla-productos-body');
  if (!tbody) return;

  const productos = RepositorioNegocio.productos;

  if (productos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No hay productos registrados aún.</td></tr>`;
    return;
  }

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
   
