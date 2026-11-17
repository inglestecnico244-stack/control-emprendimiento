# MiControl

*Gestioná · Organizá · Crecé*

🇬🇧 [Read in English](README.md)

MiControl es una aplicación web para pequeños negocios. Ayuda a los emprendedores a administrar productos, inventario, ventas y reportes desde un solo lugar, en el celular o en la computadora.

**Demo en vivo:** https://inglestecnico244-stack.github.io/control-emprendimiento/

---

## Funciones

**Cuentas**
- Registro con confirmación por correo electrónico, inicio de sesión, recuperación y cambio de contraseña.
- Cada cuenta administra su propio negocio. Los datos de distintos negocios están completamente separados.

**Dashboard**
- Ingresos de hoy, cantidad de productos y estado del sistema.
- Alertas de stock bajo (3 unidades o menos) que indican qué productos hay que reponer, con un botón rápido **Reponer**.

**Inventario**
- Agregar, editar, buscar y eliminar productos (nombre, categoría, precio de costo, precio de venta y stock).

**Ventas y caja**
- Carrito de compras: varios productos en una misma venta.
- Forma de pago (efectivo, transferencia, tarjeta de débito, tarjeta de crédito, Mercado Pago), descuento porcentual para toda la venta, observaciones y total en vivo.
- Cada venta actualiza el stock automáticamente. El stock y la venta se guardan juntos o no se guarda nada.
- Anulaciones: se anula la venta completa, se devuelve el stock y el registro queda en el historial con su motivo.

**Reportes**
- Rango de fechas, total vendido, cantidad de ventas, unidades vendidas y ganancia estimada.
- Totales por forma de pago.
- Gráficos: ventas por día (o por mes en períodos largos) y los cinco productos más vendidos.
- Historial de ventas con una fila por venta.
- Exportación a Excel (`.xlsx`) de las ventas (con una hoja de resumen) y del inventario.

**Comprobantes**
- Un comprobante detallado y no fiscal por venta, con todos sus productos. Se puede imprimir, guardar como PDF o enviar por WhatsApp.
- Lleva la leyenda *“Documento no válido como factura”*.

**Interfaz**
- Diseño adaptable a celulares y computadoras, tema azul marino y logo de la empresa.

---

## Tecnologías

| Capa | Tecnología |
| --- | --- |
| Front end | HTML5, CSS3, JavaScript (sin framework) |
| Back end | [Supabase](https://supabase.com): PostgreSQL, autenticación, funciones de base de datos (RPC) |
| Librerías | `supabase-js` v2; SheetJS para exportar a Excel (se carga cuando se usa) |
| Hosting | GitHub Pages |
| Tipografías | Google Fonts (DM Sans, Manrope) |

## Estructura del proyecto

```
control-emprendimiento/
├── index.html       # Estructura de la página y vistas
├── style.css        # Sistema visual base
├── tema.css         # Paleta de colores profesional
├── conexion.js      # Capa de acceso a datos (Supabase)
├── repositorio.js   # Lógica de negocio y estado compartido
├── app.js           # Controlador principal: autenticación, navegación, productos
└── modulos.js       # Carrito, reportes, gráficos, Excel, comprobantes, logo y correcciones
```

`modulos.js` amplía y corrige el comportamiento de los otros scripts. Tiene que cargarse **al final** en `index.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="conexion.js"></script>
<script src="repositorio.js"></script>
<script src="app.js"></script>
<script src="modulos.js"></script>
```

---

## Base de datos

**Tablas**

| Tabla | Para qué sirve | Columnas principales |
| --- | --- | --- |
| `emprendimientos` | Un negocio por cuenta | `id`, `propietario_id`, `nombre` |
| `productos` | Productos y stock | `id`, `emprendimiento_id`, `nombre`, `categoria`, `precio_costo`, `precio_venta`, `stock` |
| `ventas` | Una fila por producto vendido | `id`, `producto_id`, `nombre_producto`, `cantidad`, `total_venta`, `fecha`, `emprendimiento_id`, `forma_pago`, `precio_unitario`, `costo_unitario`, `descuento_porcentaje`, `observaciones`, `anulada`, `anulada_en`, `motivo_anulacion`, `comprobante_id` |

Todas las filas de una misma venta comparten el mismo `comprobante_id`. La columna `fecha` se guarda en UTC (`timestamp without time zone`) y el navegador la convierte a la hora local.

**Funciones (RPC)**

| Función | Qué hace |
| --- | --- |
| `registrar_venta_multiple(p_items, p_forma_pago, p_descuento_porcentaje, p_observaciones)` | Registra una venta con uno o más productos: verifica el propietario y el stock, descuenta el stock y guarda las líneas de la venta en una sola transacción. |
| `anular_venta(p_venta_id, p_motivo)` | Anula la venta completa, devuelve el stock de cada producto y conserva el registro. |
| `registrar_venta(...)` | Versión anterior de un solo producto, que se mantiene por compatibilidad. |

**Seguridad**
- La seguridad a nivel de fila (Row Level Security) está activada en todas las tablas, con una política por operación que verifica que el registro pertenezca al propietario que inició sesión.
- Los navegadores solo pueden **leer** la tabla `ventas`. Las ventas se crean y se anulan exclusivamente mediante las dos funciones anteriores, que se ejecutan con `SECURITY DEFINER`, un `search_path` fijo y controles de propiedad basados en `auth.uid()`. Los usuarios anónimos no pueden ejecutarlas.

---

## Puesta en marcha

**Requisitos previos:** un proyecto de Supabase, una cuenta de GitHub y un navegador actual.

1. Crear un proyecto en Supabase.
2. Crear las tres tablas descritas arriba y activar Row Level Security en cada una.
3. Crear las políticas de propietario y las funciones de base de datos.
4. Asegurar que cada cuenta nueva tenga su registro de negocio (en este proyecto se crea a partir del nombre del emprendimiento indicado al registrarse).
5. En `conexion.js`, completar la URL del proyecto y la clave **publicable**:
   ```js
   const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
   const SUPABASE_KEY = 'TU-CLAVE-PUBLICABLE';
   const URL_REDIRECCION = 'https://TU-USUARIO.github.io/TU-REPOSITORIO/';
   ```
6. En Supabase, abrir **Authentication → URL Configuration** y agregar la dirección del sitio.
7. Subir todos los archivos a un repositorio de GitHub y activar GitHub Pages (**Settings → Pages**).

## Uso

1. Registrarse y confirmar la dirección de correo.
2. Cargar los productos en **Inventario**.
3. En **Ventas y Caja**, agregar uno o más productos al carrito, elegir la forma de pago y procesar la venta.
4. En **Reportes**, revisar ingresos, ganancia y gráficos, abrir un comprobante, anular una venta o descargar los datos en Excel.

## Notas de seguridad

- La clave publicable es pública por diseño. **Nunca** hay que poner la clave secreta (service role) en el código del front end.
- Row Level Security es lo que mantiene privados los datos de cada negocio. Hay que verificarlo cada vez que se crea una tabla nueva.

## Limitaciones conocidas

- Cada negocio tiene una única cuenta propietaria (sin empleados ni roles).
- Los comprobantes **no** son documentos fiscales. No está implementada la facturación electrónica legal con ARCA.
- El número de comprobante sale del ID interno de la venta, por lo que no es correlativo para cada negocio.
- El límite de stock bajo es fijo (3 unidades) para todos los productos.
- La exportación a Excel necesita conexión a internet, porque SheetJS se carga al usar el botón.

## Próximos pasos

- App instalable en el celular (PWA)
- Centro de ayuda y campanita de notificaciones funcionales
- Numeración de comprobantes por negocio, con los datos de contacto del negocio en el comprobante
- Stock mínimo para cada producto
- Archivar productos en lugar de eliminarlos
- Facturación electrónica legal con ARCA (requiere el asesoramiento de un contador)

---

## Contexto académico

Desarrollado como Proyecto Final Integrador de **Inglés Técnico II**, I.S.F.T. N°244.

## Uso de inteligencia artificial

MiControl se desarrolló con la ayuda de herramientas de inteligencia artificial. Gemini inicio el proyecto, ChatGPT produjo otra versión del código, y Claude (Anthropic) se usó después para la revisión de código, la depuración, el diseño de la base de datos y la documentación. El equipo probó manualmente cada cambio y tomó las decisiones sobre el producto.

## Autores

Vazquez Andrea, Ojeda Daiana

## Licencia

Proyecto educativo. Licencia por definir.
