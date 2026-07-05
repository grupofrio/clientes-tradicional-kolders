# PR2 — Rebranding "Portal de Clientes Grupo Frío"

## Variable de entorno nueva

| Variable | Uso | Fallback |
|----------|-----|----------|
| `NEXT_PUBLIC_WA_BOT` | Número de WhatsApp del bot de servicio Grupo Frío (botón "Recibir enlace de acceso" de la portada) | `525540000990` (número REAL confirmado del bot; el fallback existe solo para no romper la portada si falta la env — configurarla en Vercel de todas formas) |

## Identidad aplicada

- Nombre oficial en UI: **Portal de Clientes Grupo Frío**.
- Paleta institucional (verificada contra grupofrio.mx): primario `#0077BB`, cian hielo `#00B8D4`, gradiente de headers `#005A8D → #00B8D4`, fondo `#F0F9FF`, texto `#0F2A3D`.
- Eliminados de la UI: KOLDOS, Portal Distribuidores, Distribuidor, Enlace KOLD, KOLD Canal Tradicional, Procesar Orden B2B, Auditoría de Pedidos, Token (visible).
- Teaser de recompensas (sin datos falsos): "Muy pronto tus compras sumarán puntos y recompensas Grupo Frío."

## Assets de marca oficiales (integrados)

- `public/brand/grupo-frio-logo.png` — logo horizontal oficial (453×243, fondo transparente). Fuente: logo corporativo de la compañía en Odoo (`res.company` 34, idéntico al asset que sirve grupofrio.mx), obtenido por lectura; recortado al contenido sin redibujar nada.
- `public/brand/grupo-frio-logo-mark.png` — mark cuadrado (solo el cubo isométrico, 231×231, transparente), extraído por recorte del logo oficial. Se usa en el chip del header del catálogo; el logo completo vive en la portada.
- `public/icon-192.png` / `public/icon-512.png` — íconos PWA regenerados: mark oficial centrado al 62% sobre fondo blanco (zona segura maskable).
- `src/app/favicon.ico` — regenerado desde el mark oficial (16/32/48 px).
- El copo/monograma placeholder quedó eliminado de la UI. Único punto pendiente de diseño: si la dirección de marca prefiere el logo sobre fondo distinto al blanco en los íconos, es cambio de 1 script.

## Copy sugerido para el bot de WhatsApp (n8n) — NO aplicado en este PR

Los cambios al workflow n8n productivo van en tarea n8n separada con S/N. Propuesta:

**Opción completa:**
> Hola, {nombre} 👋
> Aquí está tu acceso al **Portal de Clientes Grupo Frío**:
> {link}
> Desde tu portal podrás hacer pedidos, consultar tus compras y próximamente ver tus puntos y recompensas.
> Si el enlace no abre, copia y pega la liga en tu navegador.

**Opción corta:**
> Hola, {nombre} 👋 Este es tu enlace seguro al **Portal de Clientes Grupo Frío**:
> {link}
> Entra para hacer tus pedidos y consultar tu información.

## Nota de navegación

- Con sesión activa, `/` redirige a `/catalog` (ruta estable actual). Cuando exista `/home` (PR3), el destino se mueve ahí. `start_url` del manifest permanece en `/`.
