# Entregable 2 — Diagnóstico UX/UI actual (v2, ojos de tendero)

Persona: **doña Mary, dueña de abarrotes**. Le vende hielo Grupo Frío 2 veces por semana. Usa WhatsApp todo el día, no conoce la palabra "portal", no distingue B2B de B2C, y su vara de medir es "¿me sirve o me estorba?".

**Lente v2:** la pregunta ya no es solo "¿funciona?" sino **"¿esta app convence a doña Mary de que GANA algo por usarla, y de que Grupo Frío le da más que cualquier otra hielera?"**

---

## La prueba de los 10 segundos

Qué tendría que ver un tendero en los primeros 10 segundos para querer usar la app:

1. **El logo de Grupo Frío** — "ah, es de mi proveedor de hielo, es de fiar".
2. **Una promesa en una línea:** "Haz tus pedidos, gana puntos y canjea recompensas".
3. **Su nombre o el de su tienda** al entrar — "me conocen".
4. **Su pedido de siempre listo para repetir** — "esto me ahorra la llamada".
5. **Un número de puntos que crece** — "esto me conviene".

**Qué ve hoy en esos 10 segundos:** una marca desconocida ("KOLDOS"), una etiqueta que lo excluye ("Portal Distribuidores"), un botón verde, y — si logra pasar el overlay de "Abre en Safari" — un catálogo con "Disponible $0.00" arriba. **Cero de las 5 cosas.**

## Evaluación con las preguntas v2

| Pregunta | Veredicto | Evidencia |
|----------|-----------|-----------|
| ¿La app hace evidente que el cliente gana algo? | ❌ No | No hay puntos, ni promociones, ni precio preferente visible, ni siquiera un "gracias por tu compra". El único beneficio implícito es "pedir sin llamar" |
| ¿Comunica recompensas? | ❌ Cero | La palabra recompensa/puntos no existe en la UI (ni en el código) |
| ¿Genera hábito? | ❌ No | Nada crece, nada progresa, nada la invita a volver. Sin home, sin racha, sin "te toca pedir". El hábito depende 100% de la memoria del cliente |
| ¿Facilita recompra? | ⚠️ A medias | "Reordenar" existe pero está enterrado (Cuenta → Pedidos → botón) y tiene el bug del IVA. No hay "repite tu pedido de siempre" al frente |
| ¿Se siente superior a pedir por WhatsApp? | ⚠️ Apenas | Ventaja real: ver catálogo con precios y no esperar respuesta del bot/asesor. Pero pedir por WhatsApp no requiere pasar el obstáculo del magic link + Safari. **Sin recompensas, la PWA no tiene un argumento definitivo sobre el bot** — con puntos visibles y canje, sí |
| ¿Convive bien con el bot? | ⚠️ Convive por accidente | El bot da el acceso y la portada manda al bot — pero nada en la app menciona al bot como canal de servicio; el cliente que necesita ayuda no sabe si escribirle al bot, al ejecutivo o a nadie |
| ¿Parece herramienta de Grupo Frío o prototipo? | ⚠️ Prototipo pulido de otra empresa | Visualmente ordenada (rediseño navy de junio), pero con marca KOLDOS inexistente, sin logo, title "KOLD Canal Tradicional". Parece producto de una startup ajena, no de su hielera de confianza |
| ¿La portada comunica valor? | ❌ No | Explica el mecanismo ("recibe tu enlace"), no el beneficio |

## Fricciones concretas para un tendero real (sin cambios v2 + 1 nueva)

1. **El primer contacto es el peor momento de la app:** link del bot → se abre dentro de WhatsApp → overlay "Abre en Safari" con instrucciones de los `···`. Técnicamente necesario, pero es la primera impresión, con marca desconocida.
2. **Cae en el catálogo sin bienvenida**, con header "Portal Distribuidores · KOLDOS" y **"Disponible $0.00"** (la mayoría de partners no maneja crédito) — parece que no puede comprar.
3. **No hay "repetir mi pedido de siempre"** al frente, siendo LA acción del canal (compra idéntica semanal).
4. Lenguaje de ERP: "Procesar Orden B2B", "Términos Comerciales", "Auditoría de Pedidos", "Logística de Entrega".
5. La pantalla de cuenta abre con "Línea de Crédito Comercial" en rojo $0.00 — ruido intimidante para el cliente de contado.
6. Sin fotos de producto en muchos casos (placeholder) — la bolsa se reconoce por la vista.
7. **Nada la invita a volver** — no hay puntos que crezcan ni recompensas que alcanzar (la carencia central que la v2 corrige).
8. **(Nueva)** Si necesita ayuda, la app solo ofrece el WhatsApp del ejecutivo escondido en Cuenta; el bot — que es el canal de servicio 24/7 que ya existe — es invisible dentro de la app.

## Qué está bien (aprovechar, no tirar)

- **El motor comercial server-side es de calidad**: precios por pricelist real, IVA real por compañía, validación pre-checkout, idempotencia, warehouse por plaza. No se rehace — es la base que permite construir recompensas encima con confianza.
- El flujo de compra (catálogo → carrito → confirmación) es corto y funciona.
- La confirmación de pedido tiene los 3 CTAs correctos — y es el lugar perfecto para "+X puntos".
- Semáforo de facturas, PDF y modal SPEI (con el fix del fallback falso).
- El detector de WebView de WhatsApp está pulido.
- La disciplina mobile-first (max-w-md, bottom nav, touch targets) ya existe.
- **La tubería bot→magic link→PWA ya funciona** — es el cimiento del "un solo servicio digital".

## Inventario de copy a eliminar/reemplazar

| Hoy dice | Debe decir |
|----------|------------|
| KOLDOS | (eliminar — no corresponde a nada) |
| Portal Distribuidores | Portal de Clientes Grupo Frío |
| Recibir Enlace KOLD | Recibir enlace de acceso |
| Validando tu acceso de Distribuidor... | Entrando a tu portal... |
| Token de acceso no válido o ausente | Tu enlace ya no es válido. Pídele uno nuevo al asistente de WhatsApp |
| Procesar Orden B2B | Confirmar pedido |
| Términos Comerciales | Resumen de tu pedido |
| Logística de Entrega | Entrega |
| Auditoría de Pedidos | Mis pedidos |
| Facturación y Pagos | Mis pagos |
| Agrega productos desde el catálogo B2B | Agrega productos para tu tienda |
| Ejecutivo de Cuenta / Ejecutivo KOLD | Tu asesor Grupo Frío |
| "Hola, soy X (B2B)..." (mensaje WA) | "Hola, soy X, de la tienda Y..." |
| KOLD Canal Tradicional (title/manifest) | Portal de Clientes Grupo Frío |

## Diagnóstico de la portada actual

- "KOLDOS" (h1 gigante) — marca inexistente. **Corregir es prioridad 1.**
- "PORTAL DISTRIBUIDORES" — el tendero se autoexcluye ("esto no es para mí").
- Ícono SVG genérico en vez del logo real de Grupo Frío.
- Cero propuesta de valor — y por decisión v2 la propuesta DEBE incluir recompensas desde el día 1: *"Haz tus pedidos, gana puntos y canjea recompensas con Grupo Frío."*
- El CTA depende de un número hardcodeado.
- No redirige al home si ya hay sesión.

**Conclusión v2:** la app hoy es una herramienta transaccional decente con la marca equivocada y **sin su razón de ser comercial** (el programa de beneficios). El motor está; lo que falta es exactamente lo que la nueva visión pide: marca Grupo Frío + hábito de recompra + puntos/recompensas como argumento diferenciador + el bot integrado como canal de servicio. Con eso, la comparación deja de ser "app vs llamada" y pasa a ser "Grupo Frío te da algo que ninguna otra hielera te da".
