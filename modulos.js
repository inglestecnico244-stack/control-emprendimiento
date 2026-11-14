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
    .select('id, producto_id, nombre_producto, cantidad, total_venta, fecha, forma_pago, precio_unitario, costo_unitario, descuento_porcentaje, observaciones')
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

  const ventas = r.data;

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

  if (!ventas.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'empty-state';
    td.textContent = 'No hay ventas en el período seleccionado.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  ventas.forEach(v => {
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
}

document.addEventListener('DOMContentLoaded', () => {
  agregarCamposVenta();
  agregarCamposReporte();
});
