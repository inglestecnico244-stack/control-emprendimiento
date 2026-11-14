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
  const ventas = todas.filter(v => !v.anulada); // solo las activas suman

  el('reporte-total-ventas').textContent =
    formatoMoneda(ventas.reduce((t, v) => t + Number(v.total_venta), 0));
  el('reporte-cantidad-ventas').textContent = ventas.length;
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

  todas.forEach(v => {
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

// Agrega los campos nuevos al formulario de ventas (sin tocar el index.html).
function agregarCamposVenta() {
  const form = el('form-venta');
  if (!form || el('venta-forma-pago')) return;

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

  const actualizarTotal = () => {
    const producto = RepositorioNegocio.productos.find(
      p => String(p.id) === el('venta-producto-id').value
    );
    const cantidad = Number(el('venta-cantidad').value) || 0;
    const descuento = Math.min(Math.max(Number(el('venta-descuento').value) || 0, 0), 100);

    el('venta-total-previo').textContent = formatoMoneda(
      producto ? Number(producto.precio_venta) * cantidad * (1 - descuento / 100) : 0
    );
  };

  ['venta-producto-id', 'venta-cantidad', 'venta-descuento'].forEach(id => {
    ['input', 'change'].forEach(evento => el(id).addEventListener(evento, actualizarTotal));
  });
  form.addEventListener('reset', () => setTimeout(actualizarTotal));
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
  const cantidad = Number(v.cantidad);
  const total = Number(v.total_venta);

  // Las ventas anteriores no guardaron el precio unitario: se deduce del total.
  const unitario = v.precio_unitario !== null && v.precio_unitario !== undefined
    ? Number(v.precio_unitario)
    : total / cantidad;

  const subtotal = unitario * cantidad;
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
    `${cantidad} x ${v.nombre_producto}`,
    ...(hayDescuento ? [`Descuento${porcentaje}: -${formatoMoneda(descuento)}`] : []),
    `Total: ${formatoMoneda(total)}`,
    `Pago: ${nombrePago(v.forma_pago)}`,
    '',
    'Documento no válido como factura.'
  ].join('\n');

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
  <div class="fila"><span>${esc(cantidad)} × ${esc(v.nombre_producto)}</span><span>${formatoMoneda(subtotal)}</span></div>
  <div class="fila"><span>Precio unitario</span><span>${formatoMoneda(unitario)}</span></div>
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
