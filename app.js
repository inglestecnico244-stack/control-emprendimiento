/* ==========================================================================
   APP.JS - Controlador Principal de MiControl
   Autenticación, navegación, productos y ventas
   ========================================================================== */

let suscripcionAuth = null;
let usuarioActualId = null;
let procesandoAutenticacion = false;

// ==========================================================================
// INICIO DE LA APLICACIÓN
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 MiControl iniciado.');

  configurarEventosAutenticacion();
  configurarEventosProductos();
  configurarEventosVentas();
  configurarCerrarSesion();

  // Escuchar cambios en la autenticación.
  if (typeof ConexionDB.escucharCambiosAuth === 'function') {
    suscripcionAuth = ConexionDB.escucharCambiosAuth(
      (evento, sesion) => {
        // Evitar operaciones Supabase dentro del callback de Auth.
        Promise.resolve().then(async () => {
          if (evento === 'PASSWORD_RECOVERY') {
            mostrarFormularioNuevaPassword();
            return;
          }

          if (evento === 'SIGNED_OUT') {
            usuarioActualId = null;
            mostrarPantallaLogin();
            return;
          }

          if (sesion?.user) {
            await procesarSesion(sesion);
          }
        });
      }
    );
  }

  // Comprobar si ya existe una sesión.
  try {
    const resultado = await ConexionDB.obtenerSesion();

    const sesion = resultado?.data?.session || resultado?.session || null;

    if (sesion?.user) {
      await procesarSesion(sesion);
    } else {
      mostrarPantallaLogin();
    }

  } catch (error) {
    console.error('Error al comprobar la sesión:', error);
    mostrarPantallaLogin();
  }
});


// ==========================================================================
// AUTENTICACIÓN
// ==========================================================================

function mostrarPantallaLogin() {
  const pantallaAuth = document.getElementById('auth-screen');
  const panelApp = document.getElementById('app-shell');

  if (pantallaAuth) pantallaAuth.hidden = false;
  if (panelApp) panelApp.hidden = true;

  mostrarPanelAuth('login');
}

function mostrarPantallaPrincipal() {
  const pantallaAuth = document.getElementById('auth-screen');
  const panelApp = document.getElementById('app-shell');

  if (pantallaAuth) pantallaAuth.hidden = true;
  if (panelApp) panelApp.hidden = false;
}

function mostrarPanelAuth(nombrePanel) {
  const paneles = [
    'auth-login',
    'auth-registro',
    'auth-recuperar'
  ];

  paneles.forEach(id => {
    const panel = document.getElementById(id);

    if (panel) {
      panel.hidden = id !== `auth-${nombrePanel}`;
    }
  });

  limpiarMensajeAuth();
}

function mostrarMensajeAuth(mensaje, tipo = 'error') {
  const elemento = document.getElementById('auth-mensaje');

  if (!elemento) {
    alert(mensaje);
    return;
  }

  elemento.textContent = mensaje;
  elemento.className = `auth-mensaje ${tipo}`;
  elemento.hidden = false;
}

function limpiarMensajeAuth() {
  const elemento = document.getElementById('auth-mensaje');

  if (elemento) {
    elemento.textContent = '';
    elemento.hidden = true;
  }
}

function configurarEventosAutenticacion() {

  // Navegación entre formularios de autenticación.
  document.querySelectorAll('[data-auth-target]').forEach(boton => {
    boton.addEventListener('click', () => {
      const destino = boton.dataset.authTarget;
      mostrarPanelAuth(destino);
    });
  });

  // ------------------------------------------------------------------------
  // INICIAR SESIÓN
  // ------------------------------------------------------------------------

  const formLogin = document.getElementById('form-login');

  if (formLogin) {
    formLogin.addEventListener('submit', async evento => {
      evento.preventDefault();

      if (procesandoAutenticacion) return;

      const email = document.getElementById('login-email')?.value.trim();
      const password = document.getElementById('login-password')?.value;

      if (!email || !password) {
        mostrarMensajeAuth('Completá el correo y la contraseña.');
        return;
      }

      procesandoAutenticacion = true;

      try {
        const resultado = await ConexionDB.iniciarSesion(email, password);

        if (!resultado?.exito) {
          mostrarMensajeAuth(
            resultado?.mensaje || 'No se pudo iniciar sesión. Revisá tus datos.'
          );
          return;
        }

        const sesion = resultado.data?.session || resultado.data;

        if (sesion?.user) {
          await procesarSesion(sesion);
        } else {
          const sesionActual = await ConexionDB.obtenerSesion();
          const sesionRecuperada =
            sesionActual?.data?.session || sesionActual?.session;

          if (sesionRecuperada?.user) {
            await procesarSesion(sesionRecuperada);
          }
        }

      } catch (error) {
        console.error('Error al iniciar sesión:', error);
        mostrarMensajeAuth('Ocurrió un error al iniciar sesión.');

      } finally {
        procesandoAutenticacion = false;
      }
    });
  }

  // ------------------------------------------------------------------------
  // REGISTRO
  // ------------------------------------------------------------------------

  const formRegistro = document.getElementById('form-registro');

  if (formRegistro) {
    formRegistro.addEventListener('submit', async evento => {
      evento.preventDefault();

      if (procesandoAutenticacion) return;

      const nombre = document.getElementById('registro-nombre')?.value.trim();
      const apellido = document.getElementById('registro-apellido')?.value.trim();
      const emprendimiento = document.getElementById('registro-emprendimiento')?.value.trim();
      const email = document.getElementById('registro-email')?.value.trim();
      const password = document.getElementById('registro-password')?.value;
      const confirmarPassword = document.getElementById('registro-password-confirmar')?.value;

      if (!nombre || !apellido || !emprendimiento || !email || !password || !confirmarPassword) {
        mostrarMensajeAuth('Completá todos los campos.');
        return;
      }

      if (password.length < 6) {
        mostrarMensajeAuth('La contraseña debe tener al menos 6 caracteres.');
        return;
      }

      if (password !== confirmarPassword) {
        mostrarMensajeAuth('Las contraseñas no coinciden.');
        return;
      }

      procesandoAutenticacion = true;

      try {
        const resultado = await ConexionDB.registrarUsuario({
          nombre,
          apellido,
          nombre_emprendimiento: emprendimiento,
          email,
          password
        });

        if (!resultado?.exito) {
          mostrarMensajeAuth(
            resultado?.mensaje || 'No se pudo completar el registro.'
          );
          return;
        }

        formRegistro.reset();

        mostrarPanelAuth('login');

        mostrarMensajeAuth(
          '¡Registro realizado! Revisá tu correo y confirmá tu dirección para activar tu emprendimiento.',
          'exito'
        );

      } catch (error) {
        console.error('Error al registrar usuario:', error);
        mostrarMensajeAuth('Ocurrió un error durante el registro.');

      } finally {
        procesandoAutenticacion = false;
      }
    });
  }

  // ------------------------------------------------------------------------
  // RECUPERAR CONTRASEÑA
  // ------------------------------------------------------------------------

  const formRecuperar = document.getElementById('form-recuperar');

  if (formRecuperar) {
    formRecuperar.addEventListener('submit', async evento => {
      evento.preventDefault();

      const email = document.getElementById('recuperar-email')?.value.trim();

      if (!email) {
        mostrarMensajeAuth('Ingresá tu correo electrónico.');
        return;
      }

      try {
        const resultado = await ConexionDB.recuperarPassword(email);

        if (!resultado?.exito) {
          mostrarMensajeAuth(
            resultado?.mensaje || 'No se pudo enviar el correo de recuperación.'
          );
          return;
        }

        formRecuperar.reset();

        mostrarMensajeAuth(
          'Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.',
          'exito'
        );

      } catch (error) {
        console.error('Error al recuperar contraseña:', error);
        mostrarMensajeAuth('No se pudo procesar la solicitud.');
      }
    });
  }
}


// ==========================================================================
// PROCESAR SESIÓN Y CARGAR EL EMPRENDIMIENTO
// ==========================================================================

async function procesarSesion(sesion) {
  const usuario = sesion?.user;

  if (!usuario) {
    mostrarPantallaLogin();
    return;
  }

  // Evitar cargar dos veces la misma sesión.
  if (procesandoAutenticacion) return;

  if (usuarioActualId === usuario.id) return;

  procesandoAutenticacion = true;

  try {
    console.log('🔐 Usuario autenticado. Buscando emprendimiento...');

    const emprendimiento = await ConexionDB.obtenerEmprendimiento();

    if (!emprendimiento) {
      mostrarPantallaLogin();

      mostrarMensajeAuth(
        'No encontramos un emprendimiento asociado a esta cuenta. Verificá que hayas confirmado tu correo electrónico.'
      );

      return;
    }

    // Guardar la identidad del usuario activo.
    usuarioActualId = usuario.id;

    // Actualizar información de la interfaz.
    actualizarDatosUsuario(usuario, emprendimiento);

    // Cargar exclusivamente los datos del emprendimiento.
    const resultado = await RepositorioNegocio.inicializar();

    if (!resultado?.exito) {
      throw new Error('No se pudo inicializar el repositorio.');
    }

    actualizarInterfaz();

    mostrarPantallaPrincipal();

    console.log('✅ MiControl listo para trabajar.');

  } catch (error) {
    console.error('Error al cargar el emprendimiento:', error);

    usuarioActualId = null;

    mostrarPantallaLogin();

    mostrarMensajeAuth(
      'No se pudo cargar tu emprendimiento. Intentá nuevamente.'
    );

  } finally {
    procesandoAutenticacion = false;
  }
}


// ==========================================================================
// DATOS DEL USUARIO EN LA INTERFAZ
// ==========================================================================

function actualizarDatosUsuario(usuario, emprendimiento) {
  const metadata = usuario.user_metadata || {};

  const nombreCompleto = [
    metadata.nombre,
    metadata.apellido
  ].filter(Boolean).join(' ');

  const nombreVisible = nombreCompleto || usuario.email || 'Usuario';

  const elementoNombre = document.getElementById('usuario-nombre');
  const elementoEmprendimiento = document.getElementById('usuario-emprendimiento');
  const elementoAvatar = document.getElementById('usuario-avatar');

  if (elementoNombre) {
    elementoNombre.textContent = nombreVisible;
  }

  if (elementoEmprendimiento) {
    elementoEmprendimiento.textContent = emprendimiento.nombre;
  }

  if (elementoAvatar) {
    elementoAvatar.textContent = nombreVisible.charAt(0).toUpperCase();
  }
}


// ==========================================================================
// CERRAR SESIÓN
// ==========================================================================

function configurarCerrarSesion() {
  const boton = document.getElementById('btn-cerrar-sesion');

  if (!boton) return;

  boton.addEventListener('click', async () => {
    const confirmar = confirm('¿Querés cerrar tu sesión?');

    if (!confirmar) return;

    try {
      const resultado = await ConexionDB.cerrarSesion();

      if (!resultado?.exito) {
        alert(resultado?.mensaje || 'No se pudo cerrar la sesión.');
        return;
      }

      usuarioActualId = null;
      RepositorioNegocio.productos = [];
      RepositorioNegocio.ventasHoy = 0;

      mostrarPantallaLogin();

    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      alert('Ocurrió un error al cerrar sesión.');
    }
  });
}


// ==========================================================================
// NUEVA CONTRASEÑA DESPUÉS DE RECUPERACIÓN
// ==========================================================================

function mostrarFormularioNuevaPassword() {
  mostrarPanelAuth('recuperar');

  const panel = document.getElementById('auth-recuperar');

  if (!panel) return;

  // Evitar duplicar el formulario.
  if (document.getElementById('form-nueva-password')) return;

  const formulario = document.createElement('form');
  formulario.id = 'form-nueva-password';

  const titulo = document.createElement('h3');
  titulo.textContent = 'Crear una nueva contraseña';

  const etiqueta = document.createElement('label');
  etiqueta.textContent = 'Nueva contraseña';

  const campo = document.createElement('input');
  campo.type = 'password';
  campo.id = 'nueva-password';
  campo.required = true;
  campo.minLength = 6;
  campo.autocomplete = 'new-password';
  campo.placeholder = 'Ingresá tu nueva contraseña';

  const etiquetaConfirmar = document.createElement('label');
  etiquetaConfirmar.textContent = 'Confirmar contraseña';

  const campoConfirmar = document.createElement('input');
  campoConfirmar.type = 'password';
  campoConfirmar.id = 'confirmar-nueva-password';
  campoConfirmar.required = true;
  campoConfirmar.minLength = 6;
  campoConfirmar.autocomplete = 'new-password';
  campoConfirmar.placeholder = 'Repetí tu nueva contraseña';

  const boton = document.createElement('button');
  boton.type = 'submit';
  boton.textContent = 'Guardar nueva contraseña';

  formulario.append(
    titulo,
    etiqueta,
    campo,
    etiquetaConfirmar,
    campoConfirmar,
    boton
  );

  panel.appendChild(formulario);

  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();

    const password = campo.value;
    const confirmar = campoConfirmar.value;

    if (password.length < 6) {
      mostrarMensajeAuth('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmar) {
      mostrarMensajeAuth('Las contraseñas no coinciden.');
      return;
    }

    try {
      const resultado = await ConexionDB.actualizarPassword(password);

      if (!resultado?.exito) {
        mostrarMensajeAuth(
          resultado?.mensaje || 'No se pudo actualizar la contraseña.'
        );
        return;
      }

      formulario.remove();

      mostrarMensajeAuth(
        '¡Contraseña actualizada correctamente! Ya podés iniciar sesión.',
        'exito'
      );

      const resultadoCierre = await ConexionDB.cerrarSesion();

      if (resultadoCierre?.exito) {
        usuarioActualId = null;
        mostrarPantallaLogin();
        mostrarMensajeAuth(
          '¡Contraseña actualizada correctamente! Iniciá sesión con tu nueva contraseña.',
          'exito'
        );
      }

    } catch (error) {
      console.error('Error al actualizar contraseña:', error);
      mostrarMensajeAuth('Ocurrió un error al cambiar la contraseña.');
    }
  });
}


// ==========================================================================
// CONFIGURAR FORMULARIO DE PRODUCTOS
// ==========================================================================

function configurarEventosProductos() {
  const formProducto = document.getElementById('form-producto');

  if (!formProducto) return;

  formProducto.addEventListener('submit', async evento => {
    evento.preventDefault();

    const datos = {
      nombre: document.getElementById('nombre').value.trim(),
      categoria: document.getElementById('categoria').value,
      precio_costo: Number(document.getElementById('precio-costo').value),
      precio_venta: Number(document.getElementById('precio-venta').value),
      stock: Number(document.getElementById('stock').value)
    };

    if (!datos.nombre) {
      alert('Ingresá el nombre del producto.');
      return;
    }

    if (
      !Number.isFinite(datos.precio_costo) ||
      datos.precio_costo < 0 ||
      !Number.isFinite(datos.precio_venta) ||
      datos.precio_venta <= 0 ||
      !Number.isSafeInteger(datos.stock) ||
      datos.stock < 0
    ) {
      alert('Revisá los precios y el stock ingresado.');
      return;
    }

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


// ==========================================================================
// CONFIGURAR FORMULARIO DE VENTAS
// ==========================================================================

function configurarEventosVentas() {
  const formVenta = document.getElementById('form-venta');

  if (!formVenta) return;

  formVenta.addEventListener('submit', async evento => {
    evento.preventDefault();

    const productoId = document.getElementById('venta-producto-id').value;
    const cantidadVendida = document.getElementById('venta-cantidad').value;

    if (!productoId || !cantidadVendida) {
      alert('Seleccioná un producto e ingresá una cantidad válida.');
      return;
    }

    const resultado = await RepositorioNegocio.registrarVenta(
      productoId,
      cantidadVendida
    );

    if (resultado.exito) {
      formVenta.reset();
      actualizarInterfaz();
      alert('✅ ¡Venta registrada y stock actualizado con éxito!');
    } else {
      alert(`❌ Error al registrar venta: ${resultado.mensaje}`);
    }
  });
}


// ==========================================================================
// ACTUALIZAR INTERFAZ
// ==========================================================================

function actualizarInterfaz() {

  // A. Métricas del dashboard.

  const metricas = RepositorioNegocio.obtenerMetricas();

  const elementoProductos = document.getElementById('metric-productos');
  const elementoStock = document.getElementById('metric-stock-alerta');
  const elementoVentas = document.getElementById('metric-ventas');

  if (elementoProductos) {
    elementoProductos.textContent = metricas.totalProductos;
  }

  if (elementoStock) {
    elementoStock.textContent = metricas.stockBajo;
  }

  if (elementoVentas) {
    elementoVentas.textContent = `$${Number(metricas.ventasHoy).toFixed(2)}`;
  }

  // B. Tabla de inventario.

  const tbody = document.getElementById('tabla-productos-body');

  if (tbody) {
    tbody.replaceChildren();

    const productos = RepositorioNegocio.productos;

    if (productos.length === 0) {
      const fila = document.createElement('tr');
      const celda = document.createElement('td');

      celda.colSpan = 6;
      celda.className = 'empty-state';
      celda.textContent = 'No hay productos registrados aún.';

      fila.appendChild(celda);
      tbody.appendChild(fila);

    } else {
      productos.forEach(producto => {
        const fila = document.createElement('tr');

        const valores = [
          producto.nombre,
          producto.categoria,
          `$${Number(producto.precio_costo).toFixed(2)}`,
          `$${Number(producto.precio_venta).toFixed(2)}`,
          `${producto.stock} un.`
        ];

        valores.forEach((valor, indice) => {
          const celda = document.createElement('td');

          if (indice === 0) {
            const nombre = document.createElement('strong');
            nombre.textContent = valor;
            celda.appendChild(nombre);
          } else {
            celda.textContent = valor;
          }

          fila.appendChild(celda);
        });

        const celdaAcciones = document.createElement('td');
        const botonEliminar = document.createElement('button');

        botonEliminar.type = 'button';
        botonEliminar.textContent = 'Eliminar';
        botonEliminar.className = 'btn-eliminar-producto';

        botonEliminar.style.background = '#e74c3c';
        botonEliminar.style.color = 'white';
        botonEliminar.style.border = 'none';
        botonEliminar.style.padding = '5px 10px';
        botonEliminar.style.borderRadius = '4px';
        botonEliminar.style.cursor = 'pointer';

        botonEliminar.addEventListener('click', () => {
          manejarEliminarProducto(producto.id);
        });

        celdaAcciones.appendChild(botonEliminar);
        fila.appendChild(celdaAcciones);

        tbody.appendChild(fila);
      });
    }
  }

  // C. Selector de productos para registrar ventas.

  const selectVentas = document.getElementById('venta-producto-id');

  if (selectVentas) {
    selectVentas.replaceChildren();

    const opcionInicial = document.createElement('option');
    opcionInicial.value = '';
    opcionInicial.textContent = '-- Seleccioná un producto --';

    selectVentas.appendChild(opcionInicial);

    RepositorioNegocio.productos.forEach(producto => {
      const opcion = document.createElement('option');

      opcion.value = producto.id;
      opcion.textContent =
        `${producto.nombre} (Stock: ${producto.stock} - Venta: $${producto.precio_venta})`;

      selectVentas.appendChild(opcion);
    });
  }

  // D. Resumen de productos y stock.

  const resumenProductos = document.getElementById('resumen-productos');
  const resumenStock = document.getElementById('resumen-stock-bajo');

  if (resumenProductos) {
    resumenProductos.textContent = metricas.totalProductos;
  }

  if (resumenStock) {
    resumenStock.textContent = metricas.stockBajo;
  }
}


// ==========================================================================
// ELIMINAR PRODUCTO
// ==========================================================================

async function manejarEliminarProducto(id) {
  const confirmar = confirm(
    '¿Estás seguro de que deseas eliminar este producto?'
  );

  if (!confirmar) return;

  const exito = await RepositorioNegocio.eliminarProducto(id);

  if (exito) {
    alert('✅ Producto eliminado correctamente.');
    actualizarInterfaz();
  } else {
    alert('❌ Ocurrió un error al intentar eliminar el producto.');
  }
}


// ==========================================================================
// NAVEGACIÓN ENTRE VISTAS
// ==========================================================================

function cambiarVista(nombreVista, botonElemento) {

  const secciones = document.querySelectorAll('.vista-seccion');

  secciones.forEach(seccion => {
    seccion.style.display = 'none';
  });

  const seccionActiva = document.getElementById(`vista-${nombreVista}`);

  if (seccionActiva) {
    seccionActiva.style.display = 'block';
  }

  const botonesMenu = document.querySelectorAll('.menu-lateral button');

  botonesMenu.forEach(boton => {
    boton.classList.remove('activo');
  });

  if (botonElemento) {
    botonElemento.classList.add('activo');
  }
}
