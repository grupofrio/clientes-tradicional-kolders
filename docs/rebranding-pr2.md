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

## Pendiente de diseño (no bloquea)

- **Logo oficial Grupo Frío como asset local** (`public/logo-gf.svg|png`). Mientras tanto la portada usa un wordmark tipográfico + copo, y los íconos PWA (`public/icon-192/512.png`) son un placeholder generado con el gradiente institucional y monograma GF. Al recibir el asset oficial: reemplazar íconos, favicon y la marca de la portada.
- `src/app/favicon.ico` sigue siendo el anterior — reemplazar junto con el logo oficial.

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
