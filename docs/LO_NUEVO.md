# 🆕 Lo Nuevo — Dashboard Comercial Susazón V3.0

**Periodo cubierto:** 2026-05-11 al 2026-05-17
**Versión:** 3.5.0 → 3.8.0
**Fases:** 6 (UX comercial avanzada), 7 (Seguridad de sesión), 8 (Tab Insights)

Este documento resume las features agregadas después de la **Fase 5 (2026-05-10)** —
si vienes del SESSION_LOG previo, todo lo que está aquí es nuevo para ti.

---

## 🎯 Resumen ejecutivo

| Área | Antes (≤ Fase 5) | Ahora (Fase 8) |
|---|---|---|
| **Tabs del dashboard** | 7 (Tracking, Ventas, Grupo Producto, Productos, Clientes, Vendedores, Perdidos) | **8** (+ Insights) |
| **Toggle Pesos/Kilos** | Solo en Tracking Diario | **En 6 tabs** (Tracking, Ventas, Productos, Grupo, Clientes, Vendedores) |
| **PDF descargable** | No existía | **PDF "Avance Comercial"** completo (3 páginas) |
| **Seguridad de sesión** | Solo Supabase Auth default | Timeout configurable + logout remoto admin + Smart Polling |
| **Comparativos YoY** | Cierre completo (sesgaba primeros días del mes) | **Al-día equivalente** (apples-to-apples) |
| **Desfase data-vs-calendario** | Mostraba "REZAGADO" si refrescabas en la mañana | Toggle **Cierre/Hoy** lo resuelve |
| **Migraciones SQL aplicadas** | 16 | **20** |
| **Endpoints backend** | 11 | **18** (+7 nuevos) |

---

## 🚀 Features nuevas — destacadas

### 1. 💡 Tab **Insights · Análisis de Concentración** (Fase 8)

Un tab nuevo (icono 💡) dedicado a análisis avanzados no operativos. Primer
sub-análisis: **Concentración / Pareto**.

**Pregunta que responde:** *"¿qué tan dependientes somos del top X clientes /
grupos / productos?"*

**Características:**
- **Date Range Picker** con atajos rápidos: Este mes, Mes anterior, 30d, 90d, YTD, 12m, custom
- **3 dimensiones**: Grupos / Clientes / Productos (toggle independiente)
- **4 métricas**: Pesos, Kilos, Margen $, Margen % (toggle)
- **2 visualizaciones**:
  - **Treemap squarify** (algoritmo manual, área proporcional al valor, bloques cuadrados)
  - **Radar** (gradient fill + dots adaptativos + truncado dinámico para 10-15 ejes)
- **Top N selector**: 7 / 10 / 15 items + "Resto del universo"
- **Multi-select** sin límite para análisis ad-hoc
- **Estado inicial bonito**: Top 7 + Resto = octágono perfecto
- **Tabla Pareto expandible**:
  - Cada fila se expande con click para mostrar facturas del cliente o clientes que compraron del grupo/producto
  - Columnas: Venta, Kilos, Margen $, Margen %, % Universo, Acumulado, Δ pp
- **Excluir items del universo**: botón "Excluir" por fila — el 100% se recalcula sin ellos
  (útil para ignorar intercompañías, clientes atípicos, etc.)
- **Tooltip flotante moderno** con accent bar + jerarquía visual
- **Filtra por territorios del sidebar**: respeta single / aggregated-custom / aggregated-all del sidebar
- **RLS por territorio** activa (un vendedor con `allowed=['Cancún']` solo ve Cancún)

**Stack técnico:**
- `app/api/insights/concentracion` + `/api/insights/item-detail`
- Función SQL `insights_concentracion(p_from, p_to, p_dim, p_territorios)` con SECURITY INVOKER
- Componentes: `InsightsTab`, `ConcentracionAnalysis`, `ConcentracionGrid` (squarify), `TreemapHoverTooltip`, `DateRangePicker`

**Architecture-ready para crecer:** el tab Insights es un contenedor con sub-toggles.
En el futuro se pueden agregar más sub-análisis (Estacionalidad, Cohortes, Crecimiento YoY, etc.).

---

### 2. 🔐 Seguridad de sesión completa (Fase 7)

3 mecanismos coordinados que se complementan:

#### a) Timeout de inactividad configurable
- Admin elige en `/admin/configuracion`: Sin límite (default) / 35 / 45 / 60 / 90 / 120 minutos
- Listeners de mouse/keyboard/scroll/touch resetean el timer (100% cliente, 0 polling)
- A los 60s antes de expirar → modal **"¿Sigues ahí?"** con countdown grande
- Usuario marca exenciones por persona (`session_timeout_exempt` en `users_permissions`)
- Al expirar redirige a `/login?reason=idle` con banner amarillo

#### b) Logout remoto desde admin
- Panel `/admin/usuarios`: botón **"Excluir sesión"** por fila + botón **"Cerrar todas las sesiones"**
- "Cerrar todas" excluye al admin actual + usuarios marcados como exentos
- Implementación SQL: función `force_signout_user(uuid)` que borra de `auth.sessions` + `auth.refresh_tokens`
- (El método `auth.admin.signOut()` del SDK Supabase requería JWT del usuario — no funcionaba con user_id)
- Usuario afectado redirige a `/login?reason=admin` con banner rojo

#### c) Smart Polling para detectar logout remoto
3 capas combinadas:
1. **Middleware** valida en CADA request existente — 0 requests extra
2. **`visibilitychange` + `focus`** al regresar a la tab — ~10 req/día/usuario
3. **Polling fallback cada 30 min** — safety net para "usuario observando sin tocar"

Total: **~5,600 req/mes para 15 usuarios** (vs. 21,000 con polling cada 60s = **−74%**)

**Migraciones:** `017_session_security`, `018_force_signout_function`

---

### 3. ⏰ Toggle **Cierre / Hoy** — desfase data vs calendario (Fase 6)

**Problema resuelto:** si refrescabas el dashboard temprano (sin venta del día), el
sistema mostraba "REZAGADO -3pp" engañoso porque comparaba venta acumulada (hasta ayer)
contra meta lineal de hoy.

**Solución:** toggle en el header global (junto al MonthSelector) que aparece SOLO
cuando hay desfase. Permite alternar entre:
- **Cierre [13-may]** (último día con venta real)
- **Hoy [14-may]** (calendario)

**Cómo funciona:**
- Detecta automáticamente `lastDayWithSale` en el server (`max(d) WHERE venta>0`)
- Si `lastDayWithSale === actualTodayDay` → no aparece el toggle (no hay desfase)
- Click navega a `/dashboard?asOf=YYYY-MM-DD` — el server recalcula `daysCurrent`
- TODO el dashboard se recalcula automáticamente (KPIs, %, vel necesaria, etc.)

---

### 4. 🔀 Toggle **Pesos / Kilos** en 6 tabs (Fase 6)

Antes solo el tab Tracking Diario tenía toggle. Ahora también:
- Ventas (12 meses)
- Productos
- Grupo Producto
- Clientes
- Vendedores

**Comportamiento idéntico en todos**: las **líneas de margen %** se mantienen FIJAS
en el eje Y derecho cuando alternas Pesos/KG. El insight es:

> *"¿cuándo vendí más kg, mi margen % subió o bajó?"*

**Persistencia independiente** por tab (localStorage keys distintas).

---

### 5. 📊 Comparativos **al-día año anterior** (Fase 6)

**Problema resuelto:** los KPIs "vs mismo mes año anterior" comparaban contra el
CIERRE COMPLETO del mes anterior. Resultado: en el día 10 de Mayo 2026 ($22M) vs.
Mayo 2025 completo ($60M) daba **-63% engañoso**.

**Solución:** Helper `computePrevYearAlDia()` que calcula el valor del mismo día
hábil del año anterior usando `findCalendarDayForBizDays()`.

**Aplicado en:**
- KPIs del Tracking Diario (Pesos y Kilos)
- Tablas Por Territorio del PDF (Kilos y Margen)
- Stat panel del Tracking Diario muestra ambos: "al-día" y "cierre" en gris

**El comparativo principal ahora es apples-to-apples** (día N vs día N) y el cierre
se conserva como referencia secundaria.

---

### 6. 📄 PDF **Avance Comercial** (Fase 6)

Reporte completo de 3 páginas generado con `@react-pdf/renderer` (lazy import ~600KB).

**Página 1 — Tracking Diario completo:**
- 8 stats Pesos + 8 stats Kilos (idénticos al tab)
- Progress bar avance vs PTTO con marca de pace 2025
- Chart compuesto barras+líneas (acumulado, ptto lineal, año anterior) con eje Y numerado

**Página 2 — Tablas comerciales (estilo AvComSS extendido):**
- Por División (Foodservice / Distribuidores / Retail)
- Por Empresa (Susazón / Suve)
- Pesos por Territorio (11 territorios + TOTAL, con comparativo al-día 2025)
- Kilos por Territorio (con cierre como referencia)
- Margen por Territorio

**Página 3 — Detalle:**
- Top 10 Clientes con comparativo al-día año anterior + Var %
- Tracking Diario detallado por día con semáforo de velocidad necesaria

**3 modos según selección del sidebar:**
- Single (1 territorio) → reporte focalizado
- Multi (subset custom) → con tablas
- All (todos) → réplica AvComSS clásico

Botón **"Generar PDF"** disponible en los 7 tabs operativos (mismo permiso que Excel).

---

### 7. ✨ Mejoras visuales transversales

#### Theme-aware
Todo el tab Insights usa `var(--*)` CSS variables — se ve consistente en los **6 themes**
(Clean, Editorial, Warm Neo, Susazón Moderno, Stock Market, Liquid Glass).

#### Tooltips modernos
Componente común `TooltipCard` con accent bar vertical + jerarquía clara:
- Header: nombre/rank en uppercase
- Valor grande en accent
- Pill con % y label contextual

#### Treemap squarify manual
Implementación propia del algoritmo Squarify (Bruls et al. 2000) — el mismo que usa D3.
Garantiza bloques con áreas proporcionales al valor PERO con aspect ratio cercano a
1:1 (cuadrados). NUNCA produce rectángulos amorfos delgados.

---

## 📊 Métricas técnicas (Fase 6 → Fase 8)

| Indicador | Valor |
|---|---|
| Commits agregados (post Fase 5) | ~28 |
| Migraciones SQL aplicadas | +4 (017, 018, 019, 020) |
| Endpoints backend nuevos | +7 |
| Componentes nuevos | +12 |
| Hooks custom nuevos | +2 (`useIdleTimeout`, `useSessionPolling`) |
| Build time típico | 4.0-4.6s (Turbopack) |
| Bundle size delta | Mínimo (lazy imports en PDF + report-pdf) |

---

## 🔮 Próximo a venir (acordado)

- **Tab "Reporteo Semanal"** — el siguiente tab a construir tras esta documentación

---

## 📚 Documentos que se actualizaron en este respaldo

- ✅ `SESSION_LOG.md` — fases 6, 7, 8 + decisiones D018-D025 + bugs resueltos
- ✅ `INSTRUCTIVO_AGENTE.xml` — contexto técnico actualizado a versión 3.8.0
- ✅ `00_INDICE_MAESTRO.md` — fecha + versión + nuevos archivos
- ✅ `CONTINUACION_NUEVA_CONVERSACION.md` — handoff actualizado
- ✅ `LO_NUEVO.md` (este archivo) — vista ejecutiva de las features nuevas

**Replicados en Plan Z** (kebab-case):
- ✅ Plan Z `docs/` (mismo conjunto en formato kebab-case)
- ✅ `CHANGELOG.md` del root del Plan Z

---

> 🔔 **Nota para el próximo agente**: lee este archivo PRIMERO si vas a continuar el
> trabajo después de Fase 8. Te ahorra leer el SESSION_LOG entero para identificar
> qué cambió recientemente.
