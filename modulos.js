/* ==========================================================================
   MODULOS.JS — Completa y corrige MiControl
   Cargar DESPUÉS de conexion.js, repositorio.js y app.js.
   ========================================================================== */

const el = id => document.getElementById(id);

const formatoMoneda = n =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n) || 0);

const aISO = f =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;


/* 1. FECHAS CON ZONA HORARIA CORRECTA
   Antes se comparaba "fecha" con texto sin zona horaria (se leía como UTC),
   y en Argentina (UTC-3) las ventas de la noche caían en el día equivocado.
   Estas versiones reemplazan a las de conexion.js. */

ConexionDB.obtenerVentasHoyTotal = async function () {
  const emp = this.obtenerEmprendimientoActual();
  if (!clienteSupabase || !emp) return 0;

  const h = new Date();
  const { data, error } = await clienteSupabase
    .from('ventas')
    .select('total_venta')
    .eq('emprendimiento_id', emp.id)
    .eq('anulada', false)
    .gte('fecha', new Date(h.getFullYear(), h.getMonth(), h.getDate()).toISOString())
    .lt('fecha', new Date(h.getFullYear(), h.getMonth(), h.getDate() + 1).toISOString());

  if (error) {
    console.error('Error al obtener ventas del día:', error.message);
    return 0;
  }
  return (data || []).reduce((t, v) => t + Number(v.total_venta || 0), 0);
};

ConexionDB.obtenerVentasPeriodo = async function (desde, hasta) {
  const emp = this.obtenerEmprendimientoActual();
  if (!clienteSupabase || !emp) {
    return { exito: false, mensaje: 'No hay un emprendimiento activo.', data: [] };
  }
  if (!desde || !hasta || desde > hasta) {
    return { exito: false, mensaje: 'El período seleccionado no es válido.', data: [] };
  }

  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);

  const { data, error } = await clienteSupabase
    .from('ventas')
    .select('id, producto_id, nombre_producto, cantidad, total_venta, fecha, forma_pago, precio_unitario, costo_unitario, descuento_porcentaje, observaciones, anulada, motivo_anulacion')
    .eq('emprendimiento_id', emp.id)
    .gte('fecha', new Date(a1, m1 - 1, d1).toISOString())
    .lt('fecha', new Date(a2, m2 - 1, d2 + 1).toISOString())
    .order('fecha', { ascending: false });

  if (error) {
    console.error('Error al obtener historial de ventas:', error.message);
    return { exito: false, mensaje: 'No se pudo cargar el historial de ventas.', data: [] };
  }
  return { exito: true, data: data || [] };
};


/* 2. REPORTES */

// Si la fecha llega sin zona horaria, la base la guardó en UTC: se agrega "Z"
// para que el navegador la convierta bien a la hora local.
function fechaVenta(valor) {
  const texto = /[zZ]$|[+-]\d{2}(:?\d{2})?$/.test(valor) ? valor : `${valor}Z`;
  return new Date(texto).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

async function cargarReporte() {
  const r = await ConexionDB.obtenerVentasPeriodo(
    el('reporte-desde').value,
    el('reporte-hasta').value
  );

  if (!r.exito) {
    alert(`❌ ${r.mensaje}`);
    return;
  }

  const todas = r.data;
  ultimoReporte = { desde: el('reporte-desde').value, hasta: el('reporte-hasta').value, todas };
  const ventas = todas.filter(v => !v.anulada); // solo las activas suman

  el('reporte-total-ventas').textContent =
    formatoMoneda(ventas.reduce((t, v) => t + Number(v.total_venta), 0));
  el('reporte-cantidad-ventas').textContent = agruparVentas(ventas).length;
  el('reporte-unidades').textContent =
    ventas.reduce((t, v) => t + Number(v.cantidad), 0);

  // Ganancia: solo ventas que guardaron el costo (las anteriores no lo tienen).
  const conCosto = ventas.filter(v => v.costo_unitario !== null && v.costo_unitario !== undefined);
  el('reporte-ganancia').textContent = formatoMoneda(
    conCosto.reduce((t, v) => t + Number(v.total_venta) - Number(v.costo_unitario) * Number(v.cantidad), 0)
  );

  // Total por forma de pago.
  const porPago = {};
  ventas.forEach(v => {
    const clave = nombrePago(v.forma_pago);
    porPago[clave] = (porPago[clave] || 0) + Number(v.total_venta);
  });

  const caja = el('reporte-por-pago');
  caja.replaceChildren();

  if (!Object.keys(porPago).length) {
    caja.textContent = 'No hay ventas en el período seleccionado.';
  }

  Object.entries(porPago).forEach(([nombre, total]) => {
    const fila = document.createElement('div');
    fila.className = 'stat-row';
    const etiqueta = document.createElement('span');
    etiqueta.textContent = nombre;
    const importe = document.createElement('strong');
    importe.textContent = formatoMoneda(total);
    fila.append(etiqueta, importe);
    caja.appendChild(fila);
  });

  dibujarGraficos(ventas, el('reporte-desde').value, el('reporte-hasta').value);

  const tbody = el('tabla-historial-ventas');
  tbody.replaceChildren();

  if (!todas.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'empty-state';
    td.textContent = 'No hay ventas en el período seleccionado.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  agruparVentas(todas).forEach(v => {
    const tr = document.createElement('tr');
    [
      fechaVenta(v.fecha),
      v.nombre_producto,
      v.cantidad,
      formatoMoneda(v.total_venta),
      nombrePago(v.forma_pago)
    ].forEach(texto => {
      const td = document.createElement('td');
      td.textContent = texto;
      tr.appendChild(td);
    });

    const celdaAccion = document.createElement('td');
    if (v.anulada) {
      tr.style.opacity = '0.55';
      celdaAccion.textContent = 'Anulada';
      celdaAccion.title = v.motivo_anulacion || '';
    } else {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.textContent = 'Anular';
      boton.addEventListener('click', () => anularVenta(v));
      celdaAccion.appendChild(boton);
    }
    tr.appendChild(celdaAccion);

    const celdaComprobante = document.createElement('td');
    const botonComprobante = document.createElement('button');
    botonComprobante.type = 'button';
    botonComprobante.textContent = 'Ver comprobante';
    botonComprobante.style.cssText =
      'background:var(--primary-light);color:var(--primary);border-color:var(--primary-border);';
    botonComprobante.addEventListener('click', () => abrirComprobante(v));
    celdaComprobante.appendChild(botonComprobante);
    tr.appendChild(celdaComprobante);

    tbody.appendChild(tr);
  });
}


/* 3. DATOS DEL EMPRENDIMIENTO EN PANTALLA */

function actualizarModulosExtra() {
  const emp = ConexionDB.obtenerEmprendimientoActual();
  if (!emp) return;

  el('dashboard-nombre-emprendimiento').textContent = emp.nombre;
  el('usuario-emprendimiento').textContent = emp.nombre;
  el('metric-ventas').textContent = formatoMoneda(RepositorioNegocio.ventasHoy);

  const campo = el('negocio-nombre');
  if (campo && document.activeElement !== campo) campo.value = emp.nombre;

  actualizarAlertasStock();
  agregarBotonesEditar();
  dibujarCarrito();
}

// Se ejecuta cada vez que app.js refresca la interfaz.
const _actualizarInterfaz = actualizarInterfaz;
actualizarInterfaz = function () {
  _actualizarInterfaz();
  actualizarModulosExtra();
};

// Carga el reporte cada vez que se entra a la vista.
const _cambiarVista = cambiarVista;
cambiarVista = function (nombre, boton) {
  _cambiarVista(nombre, boton);

  if (nombre === 'reportes') cargarReporte();
};


/* 4. RECUPERAR CONTRASEÑA
   Al abrir el link del correo, Supabase crea una sesión y la app te mandaba
   directo al panel. Mientras dure la recuperación se bloquea ese paso. */

let modoRecuperacion = false;

const _mostrarFormularioNuevaPassword = mostrarFormularioNuevaPassword;
mostrarFormularioNuevaPassword = function () {
  modoRecuperacion = true;
  el('auth-screen').hidden = false;
  el('app-shell').hidden = true;
  _mostrarFormularioNuevaPassword();
};

const _procesarSesion = procesarSesion;
procesarSesion = function (sesion) {
  if (modoRecuperacion) return Promise.resolve(false);
  return _procesarSesion(sesion);
};

// Si una carga ya estaba en curso, tampoco puede mostrar el panel.
const _mostrarPantallaPrincipal = mostrarPantallaPrincipal;
mostrarPantallaPrincipal = function () {
  if (modoRecuperacion) return;
  _mostrarPantallaPrincipal();
};

ConexionDB.escucharCambiosAuth(evento => {
  if (evento === 'SIGNED_OUT') modoRecuperacion = false;
});


/* 5. FORMULARIOS Y BÚSQUEDA */

document.addEventListener('DOMContentLoaded', () => {
  const hoy = new Date();

  el('reporte-hasta').value = aISO(hoy);
  el('reporte-desde').value = aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));

  el('form-filtro-reportes')?.addEventListener('submit', e => {
    e.preventDefault();
    cargarReporte();
  });

  // Muestra un aviso en la caja indicada del index (o un alert si no existe).
  function mostrarAviso(idCaja, texto, ok) {
    const caja = el(idCaja);
    if (!caja) { alert(texto); return; }
    caja.textContent = texto;
    caja.className = ok ? 'mensaje-exito' : 'mensaje-error';
    caja.style.marginTop = '16px';
    caja.hidden = false;
  }

  el('form-negocio')?.addEventListener('submit', async e => {
    e.preventDefault();
    const r = await ConexionDB.actualizarNombreEmprendimiento(el('negocio-nombre').value);
    mostrarAviso('negocio-mensaje', r.mensaje, r.exito);
    if (r.exito) actualizarModulosExtra();
  });

  el('form-cambiar-password')?.addEventListener('submit', async e => {
    e.preventDefault();
    const p1 = el('config-password').value;
    const p2 = el('config-password-confirmar').value;

    if (p1.length < 8) {
      mostrarAviso('configuracion-mensaje', 'La contraseña debe tener al menos 8 caracteres.', false);
      return;
    }
    if (p1 !== p2) {
      mostrarAviso('configuracion-mensaje', 'Las contraseñas no coinciden.', false);
      return;
    }

    const r = await ConexionDB.actualizarPassword(p1);
    mostrarAviso('configuracion-mensaje', r.mensaje, r.exito);
    if (r.exito) e.target.reset();
  });

  el('busqueda-global')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();

    if (q) cambiarVista('productos', document.querySelector('[data-vista=productos]'));

    document.querySelectorAll('#tabla-productos-body tr').forEach(tr => {
      tr.hidden = !!q && !tr.textContent.toLowerCase().includes(q);
    });
  });
});


/* 6. VENTAS: FORMA DE PAGO, DESCUENTO Y OBSERVACIONES
   Requiere haber creado las columnas nuevas y la función registrar_venta
   de 5 parámetros en Supabase (script SQL). */

const FORMAS_PAGO = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  debito: 'Débito',
  credito: 'Crédito',
  mercado_pago: 'Mercado Pago'
};

const nombrePago = clave => FORMAS_PAGO[clave] || 'Sin especificar';

// Reemplaza a la versión de conexion.js: envía los datos nuevos a Supabase.
ConexionDB.registrarVentaAtomica = async function (datosVenta) {
  if (!clienteSupabase || !this.obtenerEmprendimientoActual()) {
    return { exito: false, mensaje: 'No hay un emprendimiento activo.' };
  }

  const { data, error } = await clienteSupabase.rpc('registrar_venta', {
    p_producto_id: Number(datosVenta.producto_id),
    p_cantidad: Number(datosVenta.cantidad),
    p_forma_pago: el('venta-forma-pago').value,
    p_descuento_porcentaje: Number(el('venta-descuento').value) || 0,
    p_observaciones: el('venta-observaciones').value.trim()
  });

  if (error) {
    console.error('Error al registrar venta:', error.message);
    return { exito: false, mensaje: error.message || 'No se pudo registrar la venta.' };
  }

  if (!data || data.stock_restante === undefined) {
    return { exito: false, mensaje: 'Supabase devolvió una respuesta inesperada al registrar la venta.' };
  }

  return { exito: true, data };
};

// Convierte el formulario de ventas en un carrito con varios productos y agrega
// forma de pago, descuento y observaciones (sin tocar el index.html).
function agregarCamposVenta() {
  const form = el('form-venta');
  if (!form || el('venta-forma-pago')) return;

  // La validación del producto y la cantidad pasa a hacerla el carrito.
  el('venta-producto-id').removeAttribute('required');
  el('venta-cantidad').removeAttribute('required');

  const agregar = document.createElement('button');
  agregar.type = 'button';
  agregar.className = 'btn-action-secondary';
  agregar.textContent = '＋ Agregar al carrito';
  agregar.style.cssText = 'width:100%;margin-bottom:18px;';
  agregar.addEventListener('click', agregarAlCarrito);

  const caja = document.createElement('div');
  caja.id = 'venta-carrito';
  caja.style.marginBottom = '18px';

  el('venta-cantidad').closest('.form-grupo').after(agregar, caja);

  const opciones = Object.entries(FORMAS_PAGO)
    .map(([clave, nombre]) => `<option value="${clave}">${nombre}</option>`)
    .join('');

  const bloque = document.createElement('div');
  bloque.innerHTML = `
    <div class="form-fila">
      <div class="form-grupo">
        <label for="venta-forma-pago">Forma de pago</label>
        <select id="venta-forma-pago" required>
          <option value="">Seleccionar</option>
          ${opciones}
        </select>
      </div>
      <div class="form-grupo">
        <label for="venta-descuento">Descuento (%)</label>
        <input type="number" id="venta-descuento" value="0" min="0" max="100" step="0.01">
      </div>
    </div>
    <div class="form-grupo">
      <label for="venta-observaciones">Observaciones (opcional)</label>
      <input type="text" id="venta-observaciones" maxlength="300" placeholder="Ej: entrega a domicilio">
    </div>
    <div class="quick-stats-box" style="margin-bottom:18px;">
      <div class="stat-row"><span>Total a cobrar</span><strong id="venta-total-previo">$0,00</strong></div>
    </div>`;

  form.querySelector('[type="submit"]').before(bloque);

  el('venta-descuento').addEventListener('input', dibujarCarrito);
  form.addEventListener('reset', () => setTimeout(dibujarCarrito));

  // Se ejecuta antes que el envío de app.js, que solo conoce un producto por venta.
  form.parentElement.addEventListener('submit', e => {
    if (e.target !== form) return;
    e.preventDefault();
    e.stopPropagation();
    procesarVentaCarrito(form);
  }, true);

  dibujarCarrito();
}


/* 7. REPORTES: GANANCIA Y TOTAL POR FORMA DE PAGO */

function agregarCamposReporte() {
  const vista = el('vista-reportes');
  if (!vista || el('reporte-ganancia')) return;

  const grilla = vista.querySelector('.metricas-grid');

  const tarjeta = document.createElement('div');
  tarjeta.className = 'card-metrica kpi-sage';
  tarjeta.innerHTML = `
    <div class="kpi-header"><span>Ganancia estimada</span></div>
    <h2 id="reporte-ganancia">$0,00</h2>
    <div class="kpi-footer"><span>Ventas con costo registrado</span></div>`;
  grilla.appendChild(tarjeta);

  const panel = document.createElement('div');
  panel.className = 'card-panel';
  panel.style.marginBottom = '26px';
  panel.innerHTML = `
    <div class="table-header-flex"><h3>Ventas por forma de pago</h3></div>
    <div class="quick-stats-box" id="reporte-por-pago"></div>`;
  grilla.after(panel);

  const graficos = document.createElement('div');
  graficos.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;margin-bottom:26px;';
  graficos.innerHTML = `
    <div class="card-panel"><h3>Ventas por día</h3><div id="grafico-dias" style="margin-top:14px;"></div></div>
    <div class="card-panel"><h3>Productos más vendidos</h3><div id="grafico-productos" style="margin-top:14px;"></div></div>`;
  panel.after(graficos);

  const encabezado = el('tabla-historial-ventas').closest('table').querySelector('thead tr');
  const th = document.createElement('th');
  th.textContent = 'FORMA DE PAGO';
  encabezado.appendChild(th);

  const thEstado = document.createElement('th');
  thEstado.textContent = 'ESTADO';
  encabezado.appendChild(thEstado);

  const thComprobante = document.createElement('th');
  thComprobante.textContent = 'COMPROBANTE';
  encabezado.appendChild(thComprobante);
}

document.addEventListener('DOMContentLoaded', () => {
  agregarCamposVenta();
  agregarCamposReporte();
});


/* 8. ANULAR VENTAS
   Devuelve el stock y marca la venta como anulada (no se borra).
   Requiere la función anular_venta de Supabase. */

let anulandoVenta = false;

async function anularVenta(venta) {
  if (anulandoVenta) return;

  const motivo = prompt(
    `¿Anular la venta de ${venta.nombre_producto} por ${formatoMoneda(venta.total_venta)}?\n` +
    `Se devolverán ${venta.cantidad} unidad(es) al stock.\n\nMotivo (opcional):`
  );
  if (motivo === null) return; // canceló

  anulandoVenta = true;

  try {
    const { data, error } = await clienteSupabase.rpc('anular_venta', {
      p_venta_id: Number(venta.id),
      p_motivo: motivo.trim()
    });

    if (error) {
      console.error('Error al anular venta:', error.message);
      alert(`❌ ${error.message || 'No se pudo anular la venta.'}`);
      return;
    }

    // Refrescar stock, ingresos de hoy y reporte.
    RepositorioNegocio.productos = await ConexionDB.obtenerProductos();
    await RepositorioNegocio.calcularVentasHoy();
    actualizarInterfaz();
    await cargarReporte();

    alert(
      data?.stock_devuelto
        ? '✅ Venta anulada y stock devuelto.'
        : '✅ Venta anulada. El producto ya no existe, por eso no se devolvió stock.'
    );
  } catch (error) {
    console.error('Error al anular venta:', error);
    alert('❌ Ocurrió un error al anular la venta.');
  } finally {
    anulandoVenta = false;
  }
}


/* 9. COMPROBANTE DE VENTA (no fiscal)
   Se abre en una pestaña nueva para imprimir, guardar como PDF o
   mandar por WhatsApp. Lleva la leyenda "Documento no válido como factura". */

const esc = texto =>
  String(texto ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

function abrirComprobante(v) {
  const negocio = ConexionDB.obtenerEmprendimientoActual()?.nombre || 'Mi negocio';

  // Una venta puede tener varias líneas (varios productos).
  const lineas = (v.lineas && v.lineas.length ? v.lineas : [v]).map(l => {
    const cantidad = Number(l.cantidad);
    const total = Number(l.total_venta);
    // Las ventas anteriores no guardaron el precio unitario: se deduce del total.
    const unitario = l.precio_unitario !== null && l.precio_unitario !== undefined
      ? Number(l.precio_unitario)
      : total / cantidad;
    return { nombre: l.nombre_producto, cantidad, total, unitario, subtotal: unitario * cantidad };
  });

  const subtotal = lineas.reduce((t, l) => t + l.subtotal, 0);
  const total = lineas.reduce((t, l) => t + l.total, 0);
  const descuento = Math.max(subtotal - total, 0);
  const hayDescuento = descuento > 0.005;
  const porcentaje = Number(v.descuento_porcentaje) > 0 ? ` (${Number(v.descuento_porcentaje)}%)` : '';
  const numero = String(v.id).padStart(8, '0');
  const fecha = fechaVenta(v.fecha);

  const textoWhatsApp = [
    `*${negocio}*`,
    `Comprobante N° ${numero}`,
    fecha,
    '',
    ...lineas.map(l => `${l.cantidad} x ${l.nombre}: ${formatoMoneda(l.subtotal)}`),
    ...(hayDescuento ? [`Descuento${porcentaje}: -${formatoMoneda(descuento)}`] : []),
    `Total: ${formatoMoneda(total)}`,
    `Pago: ${nombrePago(v.forma_pago)}`,
    '',
    'Documento no válido como factura.'
  ].join('\n');

  const filasProductos = lineas.map(l =>
    `<div class="fila"><span>${esc(l.cantidad)} × ${esc(l.nombre)}<br><small style="color:#64748b">${formatoMoneda(l.unitario)} c/u</small></span><span>${formatoMoneda(l.subtotal)}</span></div>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Comprobante N° ${numero}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#0f172a}
  .hoja{max-width:420px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px}
  h1{font-size:1.25rem;margin:0;color:#0b1f3a;text-align:center}
  .tipo{text-align:center;color:#64748b;font-size:.78rem;letter-spacing:1px;margin:6px 0 18px}
  .fila{display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:.92rem}
  .fila span:last-child{text-align:right}
  .linea{border-top:1px dashed #cbd5e1;margin:12px 0}
  .total{font-size:1.2rem;font-weight:700;color:#0b1f3a}
  .anulada{background:#fef2f2;color:#b91c1c;text-align:center;font-weight:700;padding:8px;border-radius:8px;margin-bottom:14px}
  .pie{text-align:center;color:#64748b;font-size:.75rem;margin-top:18px}
  .acciones{max-width:420px;margin:16px auto 0;display:flex;gap:10px}
  .acciones a,.acciones button{flex:1;text-align:center;padding:12px;border-radius:9px;border:0;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;color:#fff}
  .imprimir{background:#1e3a8a}.whatsapp{background:#059669}
  @media print{body{background:#fff;padding:0}.hoja{border:0}.acciones{display:none}}
</style></head><body>
<div class="hoja">
  <h1>${esc(negocio)}</h1>
  <div class="tipo">COMPROBANTE DE VENTA · N° ${numero}</div>
  ${v.anulada ? '<div class="anulada">VENTA ANULADA</div>' : ''}
  <div class="fila"><span>Fecha</span><span>${esc(fecha)}</span></div>
  <div class="linea"></div>
  ${filasProductos}
  ${hayDescuento ? `<div class="fila"><span>Descuento${esc(porcentaje)}</span><span>-${formatoMoneda(descuento)}</span></div>` : ''}
  <div class="linea"></div>
  <div class="fila total"><span>TOTAL</span><span>${formatoMoneda(total)}</span></div>
  <div class="fila"><span>Forma de pago</span><span>${esc(nombrePago(v.forma_pago))}</span></div>
  ${v.observaciones ? `<div class="fila"><span>Observaciones</span><span>${esc(v.observaciones)}</span></div>` : ''}
  <div class="pie">Documento no válido como factura</div>
</div>
<div class="acciones">
  <button class="imprimir" onclick="window.print()">Imprimir / PDF</button>
  <a class="whatsapp" href="https://wa.me/?text=${encodeURIComponent(textoWhatsApp)}" target="_blank" rel="noopener">WhatsApp</a>
</div>
</body></html>`;

  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const ventana = window.open(url, '_blank');

  if (!ventana) {
    alert('Tu navegador bloqueó la ventana. Permití las ventanas emergentes para este sitio e intentá de nuevo.');
  }

  setTimeout(() => URL.revokeObjectURL(url), 60000);
}


/* 10. EDITAR PRODUCTOS
   Agrega un botón "Editar" en cada fila del inventario y una ventana
   para cambiar nombre, categoría, precios y stock. */

ConexionDB.actualizarProducto = async function (id, datos) {
  const emp = this.obtenerEmprendimientoActual();
  if (!clienteSupabase || !emp) {
    return { exito: false, mensaje: 'No hay un emprendimiento activo.' };
  }

  const { data, error } = await clienteSupabase
    .from('productos')
    .update(datos)
    .eq('id', id)
    .eq('emprendimiento_id', emp.id)
    .select()
    .single();

  if (error) {
    console.error('Error al actualizar producto:', error.message);
    return { exito: false, mensaje: 'No se pudo actualizar el producto.' };
  }
  return { exito: true, data };
};

let productoEnEdicion = null;

function crearDialogoEdicion() {
  if (el('dialogo-editar-producto')) return;

  const estilo = document.createElement('style');
  estilo.textContent = `
    .dialogo-editar{border:0;border-radius:16px;padding:28px;margin:auto;width:calc(100% - 32px);max-width:560px;box-shadow:0 20px 60px rgba(15,23,42,.35);color:var(--text-main)}
    .dialogo-editar::backdrop{background:rgba(15,23,42,.55)}
    .dialogo-editar h3{font-family:var(--font-heading);color:var(--primary);font-size:1.15rem;margin-bottom:5px}
    .dialogo-editar p{color:var(--text-muted);font-size:.88rem;margin-bottom:20px;line-height:1.5}
    .editar-botones{display:flex;gap:10px;margin-top:8px}
    .editar-botones button{flex:1;margin-top:0;width:auto;padding:12px 20px}`;
  document.head.appendChild(estilo);

  const dialogo = document.createElement('dialog');
  dialogo.id = 'dialogo-editar-producto';
  dialogo.className = 'dialogo-editar';
  dialogo.innerHTML = `
    <h3>Editar producto</h3>
    <p>Para reponer mercadería, sumá las unidades nuevas al stock actual.</p>
    <form id="form-editar-producto">
      <div class="form-fila">
        <div class="form-grupo"><label for="editar-nombre">Nombre</label><input type="text" id="editar-nombre" required></div>
        <div class="form-grupo"><label for="editar-categoria">Categoría</label><input type="text" id="editar-categoria" required></div>
      </div>
      <div class="form-fila">
        <div class="form-grupo"><label for="editar-costo">Precio de costo ($)</label><input type="number" id="editar-costo" step="0.01" min="0" required></div>
        <div class="form-grupo"><label for="editar-venta">Precio de venta ($)</label><input type="number" id="editar-venta" step="0.01" min="0" required></div>
      </div>
      <div class="form-grupo"><label for="editar-stock">Stock actual</label><input type="number" id="editar-stock" step="1" min="0" required></div>
      <div id="editar-mensaje" class="mensaje-error" style="margin-bottom:14px;" hidden></div>
      <div class="editar-botones">
        <button type="button" id="editar-cancelar" class="btn-action-secondary">Cancelar</button>
        <button type="submit" class="btn-primario">Guardar cambios</button>
      </div>
    </form>`;
  document.body.appendChild(dialogo);

  el('editar-cancelar').addEventListener('click', () => dialogo.close());

  el('form-editar-producto').addEventListener('submit', async e => {
    e.preventDefault();

    const aviso = el('editar-mensaje');
    const guardar = e.target.querySelector('[type="submit"]');

    const datos = {
      nombre: el('editar-nombre').value.trim(),
      categoria: el('editar-categoria').value.trim(),
      precio_costo: Number(el('editar-costo').value),
      precio_venta: Number(el('editar-venta').value),
      stock: Number(el('editar-stock').value)
    };

    if (
      !datos.nombre || !datos.categoria ||
      !Number.isFinite(datos.precio_costo) || datos.precio_costo < 0 ||
      !Number.isFinite(datos.precio_venta) || datos.precio_venta <= 0 ||
      !Number.isSafeInteger(datos.stock) || datos.stock < 0
    ) {
      aviso.textContent = 'Revisá los datos: el precio de venta debe ser mayor que cero y el stock un número entero.';
      aviso.hidden = false;
      return;
    }

    guardar.disabled = true;
    const r = await ConexionDB.actualizarProducto(productoEnEdicion.id, datos);
    guardar.disabled = false;

    if (!r.exito) {
      aviso.textContent = r.mensaje;
      aviso.hidden = false;
      return;
    }

    const i = RepositorioNegocio.productos.findIndex(p => p.id === productoEnEdicion.id);
    if (i >= 0) RepositorioNegocio.productos[i] = r.data;

    dialogo.close();
    actualizarInterfaz();
    alert('✅ Producto actualizado.');
  });
}

function abrirEdicionProducto(producto, enfocarStock = false) {
  crearDialogoEdicion();
  productoEnEdicion = producto;

  el('editar-nombre').value = producto.nombre;
  el('editar-categoria').value = producto.categoria;
  el('editar-costo').value = producto.precio_costo;
  el('editar-venta').value = producto.precio_venta;
  el('editar-stock').value = producto.stock;
  el('editar-mensaje').hidden = true;

  el('dialogo-editar-producto').showModal();
  if (enfocarStock) el('editar-stock').select();
}

// Agrega "Editar" a cada fila del inventario (las filas siguen el orden de los productos).
function agregarBotonesEditar() {
  const filas = document.querySelectorAll('#tabla-productos-body tr');

  filas.forEach((fila, i) => {
    const producto = RepositorioNegocio.productos[i];
    const celda = fila.lastElementChild;

    if (!producto || !celda || celda.querySelector('.btn-editar-producto')) return;

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn-editar-producto';
    boton.textContent = 'Editar';
    boton.style.cssText =
      'background:var(--primary-light);color:var(--primary);border-color:var(--primary-border);margin-right:8px;';
    boton.addEventListener('click', () => abrirEdicionProducto(producto));
    celda.prepend(boton);
  });
}


/* 11. DASHBOARD: QUÉ PRODUCTOS HAY QUE REPONER */

const UMBRAL_STOCK_BAJO = 3; // el mismo criterio que usa repositorio.js

function actualizarAlertasStock() {
  const vista = el('vista-dashboard');
  if (!vista) return;

  let panel = el('panel-reposicion');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'panel-reposicion';
    panel.className = 'card-panel';
    panel.style.marginBottom = '18px';
    vista.querySelector('.dashboard-split-grid').before(panel);
  }

  const bajos = RepositorioNegocio.productos
    .filter(p => Number(p.stock) <= UMBRAL_STOCK_BAJO)
    .sort((a, b) => Number(a.stock) - Number(b.stock));

  // Texto de la tarjeta "Alertas de stock": nombra los productos.
  const pie = el('metric-stock-alerta').closest('.card-metrica').querySelector('.kpi-footer span');
  const nombres = bajos.slice(0, 3).map(p => p.nombre).join(', ');
  pie.textContent = bajos.length
    ? nombres + (bajos.length > 3 ? ` y ${bajos.length - 3} más` : '')
    : 'Todo en orden';
  pie.style.color = bajos.length ? '' : 'var(--success)';

  // Panel con el detalle.
  panel.replaceChildren();

  const titulo = document.createElement('h3');
  titulo.textContent = 'Productos para reponer';
  titulo.style.marginBottom = '14px';
  panel.appendChild(titulo);

  if (!bajos.length) {
    const texto = document.createElement('p');
    texto.className = 'panel-desc';
    texto.style.marginBottom = '0';
    texto.textContent = 'Ningún producto con stock bajo. ¡Todo en orden!';
    panel.appendChild(texto);
    return;
  }

  const caja = document.createElement('div');
  caja.className = 'quick-stats-box';

  bajos.forEach(producto => {
    const fila = document.createElement('div');
    fila.className = 'stat-row';

    const nombre = document.createElement('span');
    nombre.textContent = producto.nombre;

    const derecha = document.createElement('span');
    derecha.style.cssText = 'display:flex;align-items:center;gap:12px;';

    const unidades = document.createElement('strong');
    const sinStock = Number(producto.stock) === 0;
    unidades.textContent = sinStock ? 'Sin stock' : `${producto.stock} un.`;
    if (sinStock) unidades.style.color = 'var(--danger)';

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = 'Reponer';
    boton.style.cssText =
      'background:var(--primary-light);color:var(--primary);border:1px solid var(--primary-border);padding:6px 11px;border-radius:6px;font-weight:700;font-size:.77rem;';
    boton.addEventListener('click', () => abrirEdicionProducto(producto, true));

    derecha.append(unidades, boton);
    fila.append(nombre, derecha);
    caja.appendChild(fila);
  });

  panel.appendChild(caja);
}


/* 12. LOGO DE MICONTROL
   Las imágenes van incluidas dentro de este mismo archivo (al final),
   así que no hace falta subir ningún archivo de imagen aparte. */

function aplicarLogo() {
  const estilo = document.createElement('style');
  estilo.textContent = `
    .auth-logo{display:block;width:100%;max-width:240px;height:auto;border-radius:20px;box-shadow:0 12px 30px rgba(11,31,58,.28)}
    .sidebar-logo{width:44px;height:44px;flex-shrink:0;border-radius:11px;box-shadow:0 4px 12px rgba(0,0,0,.35)}
    @media (max-width:768px){.sidebar-logo{width:36px;height:36px}}`;
  document.head.appendChild(estilo);

  // Pantalla de acceso: el logo completo reemplaza al bloque "M + texto".
  const marcaAcceso = document.querySelector('.auth-brand');
  if (marcaAcceso) {
    const logo = document.createElement('img');
    logo.src = LOGO_COMPLETO;
    logo.alt = 'MiControl: Gestioná, organizá, crecé';
    logo.className = 'auth-logo';
    marcaAcceso.replaceChildren(logo);
  }

  // Barra lateral: el ícono reemplaza al cuadrado con la "M".
  const iconoLateral = document.querySelector('.sidebar-brand .brand-icon');
  if (iconoLateral) {
    const icono = document.createElement('img');
    icono.src = LOGO_ICONO;
    icono.alt = 'MiControl';
    icono.className = 'sidebar-logo';
    iconoLateral.replaceWith(icono);
  }

  // Ícono de la pestaña del navegador.
  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.type = 'image/png';
  favicon.href = LOGO_ICONO;
}

document.addEventListener('DOMContentLoaded', aplicarLogo);


/* IMÁGENES DEL LOGO (incluidas en el archivo; no editar) */
const LOGO_COMPLETO = 'data:image/jpeg;base64,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';
const LOGO_ICONO = 'data:image/png;base64,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';


/* 13. GRÁFICOS DE REPORTES */

let ultimoReporte = null;

// Convierte la fecha de la base (UTC, sin zona) en una fecha local.
const fechaDe = valor =>
  new Date(/[zZ]$|[+-]\d{2}(:?\d{2})?$/.test(valor) ? valor : `${valor}Z`);

function mensajeVacio(contenedor) {
  const texto = document.createElement('p');
  texto.className = 'panel-desc';
  texto.style.marginBottom = '0';
  texto.textContent = 'No hay ventas en el período seleccionado.';
  contenedor.appendChild(texto);
}

function dibujarGraficos(ventas, desde, hasta) {
  const contDias = el('grafico-dias');
  const contProductos = el('grafico-productos');
  if (!contDias || !contProductos) return;

  contDias.replaceChildren();
  contProductos.replaceChildren();

  if (!ventas.length) {
    mensajeVacio(contDias);
    mensajeVacio(contProductos);
    return;
  }

  /* Ventas por día (por mes si el período supera los 31 días) */
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  const fin = new Date(a2, m2 - 1, d2);
  const dias = Math.round((fin - new Date(a1, m1 - 1, d1)) / 86400000) + 1;
  const porMes = dias > 31;

  const clave = f => porMes
    ? `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`
    : aISO(f);

  const totales = new Map();
  ventas.forEach(v => {
    const k = clave(fechaDe(v.fecha));
    totales.set(k, (totales.get(k) || 0) + Number(v.total_venta));
  });

  const periodos = [];
  if (porMes) {
    for (let f = new Date(a1, m1 - 1, 1); f <= fin; f = new Date(f.getFullYear(), f.getMonth() + 1, 1)) {
      periodos.push(clave(f));
    }
  } else {
    for (let i = 0; i < dias; i++) periodos.push(clave(new Date(a1, m1 - 1, d1 + i)));
  }

  const etiquetaDe = k => {
    const partes = k.split('-');
    return porMes ? `${partes[1]}/${partes[0].slice(2)}` : `${partes[2]}/${partes[1]}`;
  };

  const valores = periodos.map(k => totales.get(k) || 0);
  const maximo = Math.max(...valores, 1);
  const paso = Math.ceil(periodos.length / 8);

  const barras = document.createElement('div');
  barras.style.cssText =
    'display:flex;align-items:flex-end;gap:3px;height:150px;border-bottom:1px solid var(--border-subtle);';
  const etiquetas = document.createElement('div');
  etiquetas.style.cssText = 'display:flex;gap:3px;margin-top:6px;';

  periodos.forEach((k, i) => {
    const total = valores[i];

    const barra = document.createElement('div');
    barra.style.cssText =
      `flex:1;min-width:0;border-radius:4px 4px 0 0;background:${total ? '#2563eb' : 'var(--border-subtle)'};` +
      `height:${total ? Math.max(Math.round((total / maximo) * 148), 4) : 2}px;`;
    barra.title = `${etiquetaDe(k)}: ${formatoMoneda(total)}`;
    barras.appendChild(barra);

    const etiqueta = document.createElement('span');
    etiqueta.style.cssText =
      'flex:1;min-width:0;display:flex;justify-content:center;font-size:.66rem;color:var(--text-muted);white-space:nowrap;';
    etiqueta.textContent = i % paso === 0 ? etiquetaDe(k) : '';
    etiquetas.appendChild(etiqueta);
  });

  const mejor = valores.indexOf(maximo);
  const resumen = document.createElement('p');
  resumen.className = 'panel-desc';
  resumen.style.cssText = 'margin:12px 0 0;font-size:.82rem;';
  resumen.textContent = `${porMes ? 'Mejor mes' : 'Mejor día'}: ${etiquetaDe(periodos[mejor])} (${formatoMoneda(maximo)})`;

  contDias.append(barras, etiquetas, resumen);

  /* Productos más vendidos (top 5 por unidades) */
  const porProducto = new Map();
  ventas.forEach(v => {
    const dato = porProducto.get(v.nombre_producto) || { unidades: 0, total: 0 };
    dato.unidades += Number(v.cantidad);
    dato.total += Number(v.total_venta);
    porProducto.set(v.nombre_producto, dato);
  });

  const top = [...porProducto.entries()]
    .sort((a, b) => b[1].unidades - a[1].unidades)
    .slice(0, 5);
  const maxUnidades = top[0][1].unidades;

  top.forEach(([nombre, dato]) => {
    const bloque = document.createElement('div');
    bloque.style.marginBottom = '12px';

    const fila = document.createElement('div');
    fila.className = 'stat-row';
    fila.style.marginBottom = '5px';
    const etiqueta = document.createElement('span');
    etiqueta.textContent = nombre;
    const valor = document.createElement('strong');
    valor.textContent = `${dato.unidades} un. · ${formatoMoneda(dato.total)}`;
    fila.append(etiqueta, valor);

    const fondo = document.createElement('div');
    fondo.style.cssText = 'height:8px;background:var(--bg-soft);border-radius:4px;';
    const relleno = document.createElement('div');
    relleno.style.cssText =
      `height:100%;width:${Math.round((dato.unidades / maxUnidades) * 100)}%;background:#2563eb;border-radius:4px;`;
    fondo.appendChild(relleno);

    bloque.append(fila, fondo);
    contProductos.appendChild(bloque);
  });
}


/* 14. EXPORTAR A EXCEL (.xlsx)
   Usa la librería SheetJS, que se descarga solo cuando se toca el botón. */

function cargarSheetJS() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('No se pudo cargar la librería de Excel.'));
    document.head.appendChild(script);
  });
}

async function descargarExcel(hojas, nombreArchivo) {
  try {
    await cargarSheetJS();
  } catch (error) {
    console.error(error);
    alert('❌ No se pudo preparar el Excel. Revisá tu conexión e intentá de nuevo.');
    return;
  }

  const libro = XLSX.utils.book_new();
  hojas.forEach(({ nombre, filas, anchos }) => {
    const hoja = XLSX.utils.json_to_sheet(filas);
    hoja['!cols'] = anchos.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(libro, hoja, nombre);
  });
  XLSX.writeFile(libro, nombreArchivo);
}

function exportarVentas() {
  if (!ultimoReporte || !ultimoReporte.todas.length) {
    alert('No hay ventas en el período seleccionado para exportar.');
    return;
  }

  const { desde, hasta, todas } = ultimoReporte;

  const numeroDe = new Map();
  agruparVentas(todas).forEach(g => g.lineas.forEach(l => numeroDe.set(l.id, g.id)));

  const filas = todas.map(v => {
    const cantidad = Number(v.cantidad);
    const total = Number(v.total_venta);
    const tieneCosto = v.costo_unitario !== null && v.costo_unitario !== undefined;

    return {
      'N° comprobante': String(numeroDe.get(v.id)).padStart(8, '0'),
      'Fecha': fechaVenta(v.fecha),
      'Producto': v.nombre_producto,
      'Cantidad': cantidad,
      'Precio unitario': v.precio_unitario !== null && v.precio_unitario !== undefined
        ? Number(v.precio_unitario) : total / cantidad,
      'Descuento (%)': Number(v.descuento_porcentaje) || 0,
      'Total': total,
      'Forma de pago': nombrePago(v.forma_pago),
      'Costo unitario': tieneCosto ? Number(v.costo_unitario) : '',
      'Ganancia': tieneCosto ? total - Number(v.costo_unitario) * cantidad : '',
      'Estado': v.anulada ? 'Anulada' : 'Activa',
      'Motivo de anulación': v.motivo_anulacion || '',
      'Observaciones': v.observaciones || ''
    };
  });

  // Hoja de resumen (solo ventas activas).
  const activas = todas.filter(v => !v.anulada);
  const conCosto = activas.filter(v => v.costo_unitario !== null && v.costo_unitario !== undefined);
  const resumen = [
    { Concepto: 'Período', Valor: `${desde} a ${hasta}` },
    { Concepto: 'Ventas activas', Valor: activas.length },
    { Concepto: 'Ventas anuladas', Valor: todas.length - activas.length },
    { Concepto: 'Unidades vendidas', Valor: activas.reduce((t, v) => t + Number(v.cantidad), 0) },
    { Concepto: 'Total vendido', Valor: activas.reduce((t, v) => t + Number(v.total_venta), 0) },
    {
      Concepto: 'Ganancia estimada (ventas con costo)',
      Valor: conCosto.reduce((t, v) => t + Number(v.total_venta) - Number(v.costo_unitario) * Number(v.cantidad), 0)
    }
  ];

  const porPago = {};
  activas.forEach(v => {
    const k = nombrePago(v.forma_pago);
    porPago[k] = (porPago[k] || 0) + Number(v.total_venta);
  });
  Object.entries(porPago).forEach(([nombre, total]) => {
    resumen.push({ Concepto: `Total en ${nombre}`, Valor: total });
  });

  descargarExcel(
    [
      { nombre: 'Ventas', filas, anchos: [14, 18, 28, 10, 15, 14, 14, 16, 14, 12, 10, 24, 30] },
      { nombre: 'Resumen', filas: resumen, anchos: [40, 24] }
    ],
    `MiControl_ventas_${desde}_a_${hasta}.xlsx`
  );
}

function exportarInventario() {
  const productos = RepositorioNegocio.productos;

  if (!productos.length) {
    alert('Todavía no hay productos para exportar.');
    return;
  }

  const filas = productos.map(p => ({
    'Producto': p.nombre,
    'Categoría': p.categoria,
    'Precio de costo': Number(p.precio_costo),
    'Precio de venta': Number(p.precio_venta),
    'Stock': Number(p.stock),
    'Valor del stock (a costo)': Number(p.precio_costo) * Number(p.stock)
  }));

  descargarExcel(
    [{ nombre: 'Inventario', filas, anchos: [30, 20, 16, 16, 10, 24] }],
    `MiControl_inventario_${aISO(new Date())}.xlsx`
  );
}

// Agrega el botón "Descargar Excel" en el encabezado de cada tabla.
function agregarBotonExcel(idTabla, accion) {
  const card = el(idTabla)?.closest('.card-tabla');
  const encabezado = card?.querySelector('.table-header-flex');
  if (!encabezado || encabezado.querySelector('.btn-excel')) return;

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'btn-action-secondary btn-excel';
  boton.textContent = 'Descargar Excel';
  boton.style.padding = '7px 12px';
  boton.addEventListener('click', accion);

  const contador = encabezado.querySelector('.table-counter');
  const derecha = document.createElement('div');
  derecha.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;';
  if (contador) derecha.appendChild(contador);
  derecha.appendChild(boton);
  encabezado.appendChild(derecha);
}

document.addEventListener('DOMContentLoaded', () => {
  agregarBotonExcel('tabla-historial-ventas', exportarVentas);
  agregarBotonExcel('tabla-productos-body', exportarInventario);
});


/* 15. VENTAS CON VARIOS PRODUCTOS (CARRITO)
   Cada producto del carrito queda como una línea en "ventas"; todas las líneas
   de una misma venta comparten el mismo comprobante_id.
   Requiere la función registrar_venta_multiple de Supabase. */

let carrito = []; // [{ producto_id, cantidad }]
let procesandoCarrito = false;

const buscarProducto = id =>
  RepositorioNegocio.productos.find(p => String(p.id) === String(id));

// Junta las líneas que pertenecen a la misma venta. Las ventas anteriores
// (sin comprobante_id) quedan como ventas de una sola línea.
function agruparVentas(lineas) {
  const mapa = new Map();

  lineas.forEach(l => {
    const clave = l.comprobante_id || `v${l.id}`;
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave).push(l);
  });

  return [...mapa.values()].map(ls => {
    const base = ls.reduce((a, b) => (Number(b.id) < Number(a.id) ? b : a));
    return {
      ...base, // el número de comprobante es el menor id de la venta
      lineas: ls,
      nombre_producto: ls.length === 1
        ? ls[0].nombre_producto
        : ls.map(l => `${l.nombre_producto} ×${l.cantidad}`).join(', '),
      cantidad: ls.reduce((t, l) => t + Number(l.cantidad), 0),
      total_venta: ls.reduce((t, l) => t + Number(l.total_venta), 0),
      anulada: ls.every(l => l.anulada)
    };
  });
}

function agregarAlCarrito() {
  const id = el('venta-producto-id').value;
  const cantidad = Number(el('venta-cantidad').value);

  if (!id) {
    alert('Seleccioná un producto.');
    return false;
  }
  if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
    alert('Ingresá una cantidad válida, mayor que cero.');
    return false;
  }

  const producto = buscarProducto(id);
  if (!producto) return false;

  const enCarrito = carrito.find(i => String(i.producto_id) === String(id));
  const nuevaCantidad = (enCarrito ? enCarrito.cantidad : 0) + cantidad;

  if (nuevaCantidad > Number(producto.stock)) {
    alert(`Stock insuficiente. De "${producto.nombre}" quedan ${producto.stock} unidades.`);
    return false;
  }

  if (enCarrito) enCarrito.cantidad = nuevaCantidad;
  else carrito.push({ producto_id: producto.id, cantidad });

  el('venta-producto-id').value = '';
  el('venta-cantidad').value = 1;
  dibujarCarrito();
  return true;
}

function dibujarCarrito() {
  const caja = el('venta-carrito');
  if (!caja) return;

  // Si un producto del carrito ya no existe, se quita.
  carrito = carrito.filter(i => buscarProducto(i.producto_id));
  caja.replaceChildren();

  if (!carrito.length) {
    const vacio = document.createElement('p');
    vacio.className = 'panel-desc';
    vacio.style.cssText = 'margin:0;font-size:.84rem;';
    vacio.textContent = 'El carrito está vacío. Elegí un producto, indicá la cantidad y tocá "Agregar al carrito".';
    caja.appendChild(vacio);
  } else {
    const lista = document.createElement('div');
    lista.className = 'quick-stats-box';

    carrito.forEach((item, indice) => {
      const producto = buscarProducto(item.producto_id);

      const fila = document.createElement('div');
      fila.className = 'stat-row';

      const detalle = document.createElement('span');
      detalle.textContent = `${item.cantidad} × ${producto.nombre}`;

      const derecha = document.createElement('span');
      derecha.style.cssText = 'display:flex;align-items:center;gap:10px;';

      const importe = document.createElement('strong');
      importe.textContent = formatoMoneda(Number(producto.precio_venta) * item.cantidad);

      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.textContent = 'Quitar';
      quitar.style.cssText =
        'background:var(--danger-bg);color:var(--danger);border:1px solid var(--danger-border);padding:5px 9px;border-radius:6px;font-weight:700;font-size:.74rem;';
      quitar.addEventListener('click', () => {
        carrito.splice(indice, 1);
        dibujarCarrito();
      });

      derecha.append(importe, quitar);
      fila.append(detalle, derecha);
      lista.appendChild(fila);
    });

    caja.appendChild(lista);
  }

  // Total a cobrar (con el descuento aplicado a toda la venta).
  const descuento = Math.min(Math.max(Number(el('venta-descuento')?.value) || 0, 0), 100);
  const subtotal = carrito.reduce(
    (t, i) => t + Number(buscarProducto(i.producto_id).precio_venta) * i.cantidad, 0
  );
  const previo = el('venta-total-previo');
  if (previo) previo.textContent = formatoMoneda(subtotal * (1 - descuento / 100));
}

async function procesarVentaCarrito(form) {
  if (procesandoCarrito) return;

  // Si no se tocó "Agregar" pero hay un producto elegido, se agrega solo.
  if (!carrito.length && el('venta-producto-id').value) {
    if (!agregarAlCarrito()) return;
  } else if (carrito.length && el('venta-producto-id').value) {
    if (!confirm('Hay un producto elegido que no agregaste al carrito. ¿Procesar la venta sin él?')) return;
  }

  if (!carrito.length) {
    alert('Agregá al menos un producto a la venta.');
    return;
  }

  const formaPago = el('venta-forma-pago').value;
  if (!formaPago) {
    alert('Seleccioná la forma de pago.');
    return;
  }

  const boton = form.querySelector('[type="submit"]');
  const textoOriginal = boton.textContent;
  procesandoCarrito = true;
  boton.disabled = true;
  boton.textContent = 'Registrando venta...';

  try {
    const { data, error } = await clienteSupabase.rpc('registrar_venta_multiple', {
      p_items: carrito.map(i => ({ producto_id: Number(i.producto_id), cantidad: i.cantidad })),
      p_forma_pago: formaPago,
      p_descuento_porcentaje: Number(el('venta-descuento').value) || 0,
      p_observaciones: el('venta-observaciones').value.trim()
    });

    if (error) {
      console.error('Error al registrar venta:', error.message);
      alert(`❌ Error al registrar venta: ${error.message}`);
      return;
    }

    RepositorioNegocio.productos = await ConexionDB.obtenerProductos();
    await RepositorioNegocio.calcularVentasHoy();

    carrito = [];
    form.reset();
    actualizarInterfaz();

    alert(`✅ ¡Venta registrada! Total: ${formatoMoneda(data?.total_venta)}`);
  } catch (error) {
    console.error('Error al procesar la venta:', error);
    alert('❌ Ocurrió un error al registrar la venta. Revisá los datos e intentá nuevamente.');
  } finally {
    procesandoCarrito = false;
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}
