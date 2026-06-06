# Rediseño Visual PWA KOLDOS — Spec

**Fecha:** 2026-06-06
**Alcance:** Todas las pantallas públicas y protegidas
**Restricción:** Solo cambios visuales, sin modificar funcionalidad ni APIs

---

## Decisiones de diseño

| Decisión | Elección |
|---|---|
| Dirección visual | Clean Corporate (B) |
| Layout de producto | Grid 2 columnas con imagen (B) |
| Control de cantidad | Botones +/− (reemplaza input manual) |
| Paleta | Azul marino profundo + fondo azul claro |

---

## 1. Tokens de color (tailwind.config.ts)

Reemplazar la paleta actual por:

```ts
colors: {
  background: "#EFF6FF",       // azul muy claro (era #F8FAFC gris)
  foreground: "#1E293B",       // slate oscuro (sin cambio)
  primary: {
    DEFAULT: "#1E3A8A",        // azul marino profundo (era #0066FF)
    foreground: "#ffffff",
  },
  secondary: {
    DEFAULT: "#EFF6FF",
    foreground: "#1E293B",
  },
  accent: {
    DEFAULT: "#2563EB",        // azul brillante para hover/activo (era #00B4FF)
    foreground: "#ffffff",
  },
  card: {
    DEFAULT: "#ffffff",
    foreground: "#1E293B",
  },
  border: "#DBEAFE",           // azul muy suave (era #CBD5E1 gris)
  muted: {
    DEFAULT: "#EFF6FF",
    foreground: "#6B7280",
  },
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
}
```

---

## 2. Catálogo (`/catalog`)

### Header
- Fondo: gradiente `from-[#1E3A8A] to-[#2563EB]`
- Nombre del distribuidor: `text-white font-black text-xl`
- Crédito disponible: card `bg-white/12 rounded-xl` dentro del header
- Buscador: `bg-white/15 rounded-xl` (sin borde visible)

### Tabs de familia
- Fondo de la barra: `bg-white border-b border-border`
- Tab activo: `bg-primary text-white shadow-md`
- Tab inactivo: `bg-secondary text-muted-foreground border border-border`
- Contador de productos en el label del tab: `opacity-70`

### Acordeón de subgrupo
- Header: `bg-gray-50/80` con ícono emoji a la izquierda del nombre
- Badge de cantidad: `bg-blue-50 text-primary border border-blue-100`

### Tarjeta de producto (grid 2 columnas)
- Contenedor: `rounded-2xl border border-border shadow-sm overflow-hidden`
- Imagen: área `h-24 bg-gradient-to-br from-secondary to-blue-100 flex items-center justify-center`
  - Si hay `image_url`: `<img>` con `object-cover`
  - Fallback Laurita: emoji 🧊 `text-4xl`
  - Fallback Kold: emoji 📦 `text-4xl`
- Badge "EN CARRITO": `absolute top-0 right-0 bg-accent text-white text-[7px] font-black px-2 py-1 rounded-bl-lg`
- Body padding: `p-2.5`
- Nombre: `text-[10px] font-bold leading-tight min-h-[28px]`
- Metadata (uom, caja): `text-[8px] text-muted-foreground`
- Precio: `text-base font-black text-primary`
- Control +/−:
  - Fila: `flex items-center justify-between mt-2`
  - Botón −: `w-[30px] h-[30px] rounded-lg border border-border bg-card text-muted-foreground font-bold text-lg`
  - Botón − activo (en carrito): `bg-blue-100 border-none text-accent`
  - Cantidad: `text-sm font-black text-foreground text-center w-6`
  - Botón +: `w-[30px] h-[30px] rounded-lg bg-primary text-white font-bold text-lg border-none`
- Estado en carrito: borde `border-2 border-accent shadow-accent/20 shadow-md`

### Barra flotante del carrito
- Reemplaza el botón flotante circular actual
- Card full-width: `mx-3 mb-3 bg-gradient-to-r from-primary to-accent rounded-2xl p-3 flex justify-between items-center shadow-primary/35 shadow-lg`
- Izquierda: ícono carrito + "N productos"
- Derecha: `$XX.XX →`

---

## 3. Carrito (`/cart`)

- Header: mismo gradiente que catálogo, título "Tu Pedido"
- Lista de productos: fila con imagen 48px, nombre, cantidad (texto), precio unitario y subtotal
- Total al pie: card `bg-white border-t-2 border-primary` fija al fondo (sobre el bottom nav)
  - Subtotal, IVA si aplica, **Total** en `text-xl font-black text-primary`
- Botón "Confirmar Pedido": `w-full bg-gradient-to-r from-primary to-accent text-white rounded-2xl h-14 font-black`

---

## 4. Pedidos (`/account/orders`)

- Header: gradiente, título "Mis Pedidos"
- Lista: cards con:
  - Número de orden + fecha
  - Pill de estado: `Confirmado` (azul), `En camino` (naranja), `Entregado` (verde), `Cancelado` (rojo)
  - Total del pedido en `font-black text-primary`
  - Flecha de detalle `>`
- Estado vacío: ilustración frío con texto "Aún no tienes pedidos"

---

## 5. Cuenta (`/account`)

- Header: gradiente con avatar circular (inicial del nombre) `w-16 h-16 bg-white/20 text-white text-2xl font-black rounded-full`
- Card de crédito: `bg-white rounded-2xl p-4 shadow-sm border border-border`
  - "Crédito total" / "Usado" / "Disponible" en 3 columnas
- Sección facturas: lista con fecha de vencimiento, monto, pill rojo si vencida
- Botón cerrar sesión: `text-danger font-bold` al fondo, sin estilo destructivo prominente

---

## 6. Login (`/`)

- Fondo: `bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE]`
- Logo/marca: `KOLDOS` en `text-5xl font-black text-primary`, subtítulo `PORTAL DISTRIBUIDORES` en tracking amplio
- Ícono decorativo: cristal de hielo o copo grande centrado arriba del título
- Botón WhatsApp: `bg-[#25D366] text-white rounded-2xl h-14 flex items-center gap-3 font-bold` con ícono SVG de WhatsApp
- Texto de ayuda: "Se abrirá WhatsApp. El bot te envía tu enlace en segundos." en `text-xs text-muted-foreground text-center`

---

## 7. BottomNav

- Fondo: `bg-white border-t border-border`
- Ítem activo: ícono en `text-primary`, label `font-bold text-primary`, punto indicador debajo `w-1 h-1 bg-primary rounded-full`
- Ítem inactivo: `text-muted-foreground`
- Badge del carrito: `bg-danger text-white` (sin cambio)

---

## 8. Facturas (`/account/invoices`)

- Header: gradiente, título "Mis Facturas"
- Lista: cards con folio, fecha de emisión, fecha de vencimiento, monto
- Pill de estado: `Vigente` (azul), `Vencida` (rojo con fondo rojo claro)
- Botón PDF por factura: ícono de descarga `text-primary`
- Estado vacío: texto "Sin facturas registradas"

---

## Archivos a modificar

1. `tailwind.config.ts` — nuevos tokens
2. `src/app/(protected)/catalog/page.tsx` — grid + botones +/−
3. `src/app/(protected)/cart/page.tsx` — rediseño completo
4. `src/app/(protected)/account/orders/page.tsx` — rediseño completo
5. `src/app/(protected)/account/invoices/page.tsx` — rediseño completo
6. `src/app/(protected)/account/page.tsx` — rediseño completo
7. `src/app/(public)/page.tsx` — login rediseño
8. `src/components/BottomNav.tsx` — punto indicador + estilos

## Archivos que NO se modifican

- Toda la lógica de `/api/*`
- `src/lib/*`, `src/store/*`
- `src/app/(public)/auth/page.tsx` (ya tiene lógica de WebView reciente)
- `src/app/(protected)/order/confirmed/page.tsx`
