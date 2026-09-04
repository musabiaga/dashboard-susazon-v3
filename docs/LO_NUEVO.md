# 🆕 Lo Nuevo — Dashboard Comercial Susazón V4.3

**Periodo cubierto (V4.3):** 2026-07-30 al 2026-09-03 (Fase 17)
**Versión:** 4.2.0 → **4.3.0**
**Bloques:** Profundización del tab **Clientes y Productos** · Tracking **Comparar vs año anterior** · 4º KPI **Prom. Venta Diario** · Insights·Concentración **cruzar dimensiones**
**Migraciones:** 041-045 (total **45**) · **Datos:** Ene 2024 – Sep 2026 (~384K filas)

## 🚀 V4.3 en una línea

- **Clientes y Productos, a profundidad** — (1) gráfica **"Meses (3 años)"**: 12 meses × 3 años agrupados + 3 líneas de margen %, homologada al tab Ventas (`ClientesTresAniosChart`, commits `dd4f11b` `23ae3f4`). (2) **Expand mensual bidireccional** en "Meses {año}": SKU → clientes por mes / cliente → SKUs por mes; meses sin compra en rojo tenue ("**campo minado**") + "sin comprar desde MMM" (migr **041** `insights_cliente_sku_mensual`, endpoint `cliente-sku-mensual`, `05ee073`). (3) **Territorio(s)** en ese expand cuando el scope es "Todos" (reemplaza el churn; migr **044**, `f7a3f7c`). (4) **Orden por columna** en las 3 vistas + fix del dropdown "congelado" al cambiar territorio (cache llaveado por scope, `588e5a9`). (5) **Buscador con universo de AÑO COMPLETO** — antes solo listaba items con venta en el mes seleccionado (migr **043** `dim_universe_year`, endpoint `dim-universe`, `fullYearSearchContext`, `608a20f`). (6) **Desglose "Año vs Año" con 3 años** al expandir producto → clientes y cliente → SKUs (`DesgloseYoYTable` compartido; `cliente-desglose` reescrito por SKU; `d8c9e2a` `0b970ca`). (7) **4ª vista "Meses Hist."**: matriz Años×Meses expandible con heatmap, celda según Pesos/Kilos (migr **045** `dim_mensual_multianio`, `MesesHistTable`, `a4f136d`).
- **Tracking Diario — "Comparar vs año anterior (al día)"** — toggle on-demand: barras del año anterior junto a las actuales, tabla pareada por día con Δ% + TOTAL al día, y expandible por día → clientes actual vs anterior (Nuevo/Perdido). Cero backend (`TrackingCompareYoY`, `5057048`). **Fix:** la línea de Ptto Linear cierra en su total en el último día hábil (eje X extendido a todos los días hábiles, `800113a`).
- **KPI header — 4º KPI "Prom. Venta Diario"** = venta al día ÷ días hábiles transcurridos, delta vs AA al día, VS PTTO diario, histograma mensual; y **ACUM 2024/25/26 consolidada** en una pastilla vertical (grid 9 col, `d292431`).
- **Insights · Concentración — cruzar dimensiones**: fila "Filtrar por" (Producto/Cliente/Grupo/Familia) acota el universo del Pareto; + dimensión **Familias** (migr **042** `insights_concentracion_cruzada`, nombre nuevo para no tocar Agrupadores; `f4faba8`).
- **Parqueado (no desplegado):** sincronización automática de datos — diseñada con 2 motores (pg_cron+Vault con `CRON_SECRET` / auto-al-abrir sin secreto) y revertida a petición de Mauricio; el refresh sigue **100% manual**. Artefacto en `docs/parked/idea1-sync-auto/`.

> **Regla de diseño V4.3:** las funciones nuevas replican el scoping *territorios + rama de agrupador* de `insights_concentracion_cruzada` y son `SECURITY INVOKER`; si una función cambia de firma se crea con **nombre nuevo** (o `DROP+CREATE`) para no romper consumidores; los detalles (expands, universo, matriz) se cargan **lazy por territorio** desde el cliente, nunca en el payload inicial (tope de 1000 filas de PostgREST).

---

# 🆕 Lo Nuevo — Dashboard Comercial Susazón V4.2 (histórico)

**Periodo cubierto (V4.2):** 2026-07-12 al 2026-07-19
**Versión:** 4.1.0 → **4.2.0**
**Bloque:** Insights — **6º sub-análisis "Crecimiento x Vendedor"**

## 🚀 V4.2 en una línea

- **Insights #6 — Crecimiento x Vendedor** — para evaluar el desempeño de cada vendedor: dos tablas lado a lado (**Año Anterior** vs **Año Actual**) con **Mes** y **Acumulado** de su cartera, por **cliente** o por **producto**. Se filtra por vendedor (+ territorio/agrupador del sidebar) y **compara al mismo día** (capa el año en curso a la última fecha con datos) para que el crecimiento sea justo. **6 mediciones** en un toggle: **Kg · $ · Margen % · Margen $ · Variedad (No. SKUs) · Ticket Promedio**. Cada fila trae **Δ% Mes** y **Δ% Acum** con color (Nuevo 🟢 / −100% 🔴; el margen % en puntos porcentuales). Migraciones 038-040, endpoint `crecimiento-vendedor`, componente `CrecimientoVendedorAnalysis`.

### Las 2 mejoras que lo vuelven confiable

- **① Totalizador REAL (fila TOTAL fija al pie de ambas tablas).** No es la suma de los renglones — es una agregación aparte sobre TODO el scope: **Σ pura** para Kilos/$/Margen $, **COUNT(DISTINCT)** para Variedad y # de tickets, **Margen % = Σmargen ÷ Σventa**, **Ticket Prom. = Σventa ÷ #tickets**. El Δ del total se calcula de los totales 2025 vs 2026, nunca promediando filas. *Por qué importa:* sumar los renglones de Variedad daría **6,793 SKUs** cuando el número REAL es **272** (el mismo SKU lo compran muchos clientes). La venta sí cuadra exacta ($822M = Σ filas, por ser aditiva) y el Margen % real sube de 13.0% a **15.2%**.
- **② Ticket Promedio.** El ticket se arma con **fecha + cliente** (no hay folio en los datos; junta Susazón + Suve del mismo día). En dimensión **Clientes** mide **$ por ticket**; en **Productos**, **kg por ticket**.

> **¿Por qué V4.2?** Un 6º sub-análisis completo de Insights, con lógica de totalización que respeta la regla de gobernanza del proyecto (la métrica se define por regla de negocio, no por lo que es fácil de sumar en pantalla). Aditivo, no rompe nada existente.

---

# 🆕 Lo Nuevo — Dashboard Comercial Susazón V4.1 (histórico)

**Periodo cubierto (V4.1):** 2026-06-16 al 2026-07-05
**Versión:** 4.0.0 → **4.1.0**
**Bloques:** 5º Insight (Penetración/Canasta) · **Módulo Agrupadores** (territorios virtuales, Fase 1→3) · Histograma mensual en las pastillas de Tracking

## 🚀 V4.1 en una línea

- **Agrupadores** — territorios *virtuales*: agrupas cualquier combinación de clientes / productos / grupos / territorios y aparece en la barra lateral como un territorio más que re-filtra **TODO** el dashboard. Frontera de seguridad real (un KAM ve SOLO su agrupador vía RLS), meta manual (PTTO sintético mensual → cumplimiento en el header) y export (PDF + Excel). Opera en los 7 tabs. Migraciones 029-037. Commits `48f6d82`…`19aba43`.
- **Insights #5 — Penetración / Canasta** — amplitud de canasta: por cliente = # SKUs que compra, por SKU = # clientes que lo compran, vs el año anterior. Scatter + tabla drill-down + Excel. Migración 028.
- **Histograma en las pastillas** — hover/tap en Venta / Margen / KG (Tracking Diario) → histórico mensual: barras + línea de tendencia, toggle Timeline ↔ Comparativo por año, hover = valor + Δ YoY. Cero backend. Commit `abe8071`.
- **Fixes:** reactivación de usuarios (confirmar email + is_active); Perdidos sin duplicados (agrupa por nombre).

> **¿Por qué V4.1?** Un módulo nuevo completo (Agrupadores) + un 5º Insight + interactividad en Tracking, todo aditivo y sin romper el modo territorios normal.

---

# 🆕 Lo Nuevo — Dashboard Comercial Susazón V4.0 (histórico)

**Periodo cubierto:** 2026-05-23 al 2026-06-07
**Versión:** 3.9.0 → **4.0.0**
**Fases:** 10 (Tracking Diario · 2 cards nuevas), 11 (Tab unificado "Clientes y Productos"), 12 (Insights ampliado: 4 sub-análisis)

Este documento resume las features agregadas después de la **Fase 9 (2026-05-23)** —
si vienes del SESSION_LOG previo (v3.9.0), todo lo que está aquí es nuevo para ti.

> **¿Por qué V4.0?** Tres bloques grandes: el tab Insights pasó de 1 a **4 sub-análisis**
> (de un solo análisis a una suite de inteligencia comercial), los tabs Productos y
> Clientes se **fusionaron** en uno solo combinable, y Tracking Diario ganó 2 cards.
> Es un salto mayor de capacidad → versión mayor.

---

## 🎯 Resumen ejecutivo (V3.9 → V4.0)

| Área | Antes (v3.9.0) | Ahora (v4.0.0) |
|---|---|---|
| **Tabs del dashboard** | 8 (Tracking, Ventas, Grupo, **Productos**, **Clientes**, Vendedores, Perdidos, Insights) | **7** (Productos + Clientes → **"Clientes y Productos"** combinable) |
| **Sub-análisis de Insights** | 1 (Concentración) | **4** (Concentración, Precio $/kg, Cuadrante BCG, Estacionalidad) |
| **Vista de Concentración** | Treemap + **Radar** | Treemap + **Pareto** (barras + % acumulado) |
| **Dimensiones de Concentración** | 3 (Clientes/Grupos/Productos) | **4** (+ **Territorios**) |
| **Cards de Tracking Diario** | KPIs base | + **Variedad de SKUs** + **Clientes Activos** |
| **Migraciones SQL aplicadas** | 20 | **24** (021-024) |
| **Endpoints backend** | 18 | **29 totales** (5 nuevos esta versión) |
| **Ayuda contextual** | — | **Popover "Cómo leer esto"** en el foco de Insights (por sub-análisis) |

---

## ⭐ Fase 12 (2026-06-06 al 2026-06-07) — Insights: de 1 a 4 sub-análisis

Lo más grande de V4.0. El tab Insights ahora es una **suite de inteligencia comercial**
con 4 sub-análisis detrás de un toggle (Concentración · Precio $/kg · Cuadrante · Estacionalidad).
Cada uno es un componente independiente y "podable" (quitar uno = borrar una línea de
`SUB_ANALYSES`).

### a) Concentración — Pareto reemplaza Radar + dimensión Territorios
- La vista **Radar** se reemplazó por **Pareto** (barras por item de mayor a menor +
  línea de **% acumulado** en eje derecho). Es el estándar para leer concentración:
  *"el top N cubre X% del total"*. El Radar no comunicaba dependencia; el Pareto sí.
- Nueva dimensión **Territorios** (además de Clientes/Grupos/Productos). El drill-down de
  un territorio muestra los clientes que facturaron ahí.
- Migración suave de localStorage: quien tenía `radar` guardado pasa a `pareto`.

### b) 🆕 Precio $/kg (Dispersión de precio)
**Pregunta:** *¿a qué precio/kg le vendemos el MISMO producto a cada cliente? ¿Dónde
dejamos dinero en la mesa?*
- Eliges **nivel** (SKU / Grupo / Familia) y un **item** (selector con búsqueda — hay 411 SKUs).
- **Scatter**: cada punto = un cliente. X = precio/kg ponderado (Σventa÷Σkg), Y = volumen.
  Línea de **promedio ponderado** + umbral **"paga barato"** (−X% configurable en vivo).
  🔴 paga barato · 🟡 bajo promedio · 🟢 en/sobre.
- **Piso de volumen** configurable (cubrir X% del volumen, default 95%) para descartar la
  cola de compras mínimas.
- **Tabla ordenable por columna** con **"dinero en la mesa"** = (promedio − precio del
  cliente) × su volumen, en pesos concretos.
- Maneja el caso de marca privada / 1 cliente (sin dispersión) con mensaje claro.

### c) 🆕 Cuadrante de cartera (BCG)
**Pregunta:** *¿a quién cuido, a quién rescato, en quién apuesto, a quién suelto?*
- **Scatter**: X = tamaño (venta, escala **log**), Y = crecimiento YoY %, burbuja = margen $.
- 4 cuadrantes: ⭐ **Estrella** (grande+crece) · 🟥 **En riesgo** (grande+cae) ·
  🔷 **Apuesta** (chico+crece) · ⬜ **Marginal** (chico+cae).
- **Umbrales configurables en vivo** (tamaño default = mediana del periodo, crecimiento = 0%).
- **Nuevos del periodo** (sin venta el año anterior) van en sección aparte.
- **Comparación YoY justa:** el periodo actual se capa a la última fecha con datos y se
  compara contra **el mismo tramo de fechas** del año anterior (ver bug #41). Reusa la
  dimensión (Clientes/Grupos/Productos/Territorios) y el date range del tab.

### d) 🆕 Estacionalidad (heatmap)
**Pregunta:** *¿qué meses son pico/valle? ¿cuándo compro, produzco y promociono?*
- **Heatmap** mes × dimensión. Celda = **índice de estacionalidad** (valor del mes ÷
  promedio mensual de ESE item × 100; 100 = mes típico, 🔵 valle <100, 🟧 pico >100) o
  **valor absoluto** (toggle).
- **Año** seleccionable (2024/2025/2026); el año parcial se marca y blanquea los meses
  sin datos.
- **Métrica Kg** por default (planeación de producción), toggle a Pesos.
- Dimensiones: Grupos/Territorios completos; Clientes/SKUs con **Top N** (alta cardinalidad).

### e) Popover de ayuda "Cómo leer esto"
- Hover (o focus por teclado) sobre el **foco 💡** del header de Insights abre un popover
  que explica cómo interpretar el sub-análisis activo. Texto distinto por sub-análisis.
  Badge **"?"** para señalar que es interactivo.

**Stack Fase 12:** migraciones `021_insights_concentracion_dim_territorios`,
`022_insights_precio_items`, `023_insights_cuadrante`, `024_insights_estacionalidad`.
Endpoints `precio-dispersion`, `cuadrante`, `estacionalidad`. Componentes
`PrecioAnalysis`, `CuadranteAnalysis`, `EstacionalidadAnalysis`, `ItemPicker`.

---

## 🔗 Fase 11 (2026-06-06) — Tab unificado "Clientes y Productos"

Los tabs **Productos** y **Clientes** se fusionaron en uno solo (8 → 7 tabs) sin perder
nada de Clientes y replicando todo Productos encima.

**3 toggles independientes en el header:**
- **Gráfica:** Clientes | Productos
- **Tabla:** Clientes | Productos
- **Volumen:** Pesos | Kilos (compartido)

**Estrategia (sin romper Clientes):** si gráfica y tabla son la misma dimensión →
un solo `DimensionTab` monolítico (idéntico al Clientes de siempre). Si difieren →
una instancia solo-gráfica + otra solo-tabla (ej. gráfica de Clientes + tabla de Productos).

**Mejoras encima:**
- **Buscador propio en la tabla** cuando es standalone (gráfica y tabla con dimensiones
  distintas) — antes la tabla no tenía buscador en ese modo.
- **Desglose simétrico SKU → clientes:** en la tabla de Productos, vista "Año vs Año",
  expandir un SKU muestra los **clientes que lo compran** (espejo del desglose
  cliente → grupo → SKU de Clientes).

**Stack:** `ClientesProductosTab` (contenedor render-prop), `DimensionTab` generalizado
con `dim=cliente|sku` + `controlledMode` + `showChart`/`showTable`, `ProductoDesglose`.
Endpoints `clientes-evolution` / `clientes-ritmo-90d` generalizados a `dim`.

---

## 📊 Fase 10 (2026-06-01 al 2026-06-02) — Tracking Diario: 2 cards nuevas

- 🆕 **Variedad de SKUs:** cuántos SKUs distintos se han facturado en el mes (vs mes
  anterior y año anterior al-día). Endpoint `tracking-variedad`.
- 🆕 **Clientes Activos:** cuántos clientes distintos compraron en el mes (al-día).
  Endpoint `tracking-clientes-activos`.
- 🐞 **Fix crítico de conteo:** Clientes Activos se contaba por `no_cliente`, pero cada ERP
  (Susazón / Suve) numera a sus clientes por separado → el mismo cliente (ej. "20 CANCUN")
  se contaba doble. Se corrigió a **contar por nombre de cliente** (ver bug #38).

---

## 🔢 Migraciones SQL nuevas (V4.0)

| # | Archivo | Propósito |
|---|---|---|
| 021 | `insights_concentracion_dim_territorios.sql` | Agrega `territorios` como dimensión de agrupación a `insights_concentracion` |
| 022 | `insights_precio_items.sql` | Lista items por nivel (sku/grupo/familia) con kg+venta — alimenta el selector de Precio $/kg |
| 023 | `insights_cuadrante.sql` | venta/kg/margen actual + venta del mismo rango año anterior, por dimensión (BCG) |
| 024 | `insights_estacionalidad.sql` | Valor mensual (kg/venta) por item del Top N, para un año (heatmap) |

Todas con `SECURITY INVOKER` (heredan la RLS de territorio del usuario).

---

## 🐞 Bugs notables resueltos (V4.0)

- **#38** Clientes Activos contaba doble (por `no_cliente` en vez de por nombre) → −250 clientes fantasma en mayo.
- **#41** Cuadrante BCG comparaba un periodo actual incompleto contra una ventana más larga del año anterior (ej. 5 días 2026 vs 7 días 2025) → mostraba −24% falso cuando en realidad era +12%. Fix: capar el periodo actual a la última fecha con datos y alinear la ventana previa al mismo tramo.

(Detalle completo en `SESSION_LOG.md`, bugs #38-#42.)

---

## 🔮 Próximo a venir (acordado)

- **Tab "Presentación Semanal"** — réplica del PPT de la junta directiva (sub-tabs
  Asesores / Ciudades / Productos). **BLOQUEADO**: requiere que Mauricio defina primero
  las **cuotas/objetivos por asesor**. Spec + discovery hechos.
- **Fase 3 del tab Clientes y Productos** (acordada, no iniciada): selector global de
  rango de fechas donde los toggles operan sobre el rango, comparativo = mismas fechas
  calendario.

---

## 📚 Documentos actualizados en este respaldo (V4.0)

**Repo `/docs`:**
- ✅ `SESSION_LOG.md` — Fases 10-12 + decisiones D028-D031 + bugs #38-#42 + versión 4.0.0
- ✅ `INSTRUCTIVO_AGENTE.xml` — Fases 10-12, componentes/endpoints/migraciones nuevos, versión 4.0
- ✅ `00_INDICE_MAESTRO.md` — versiones, fechas y descripciones a V4.0
- ✅ `CONTINUACION_NUEVA_CONVERSACION.md` — handoff al estado actual
- ✅ `LO_NUEVO.md` (este archivo) — vista ejecutiva de V4.0
- ✅ `01`-`06` `.docx` — regenerados a v4.0.0 vía `gen_docs.py`
- ✅ `Instructivo_Usuario_Visual.html` / `.pdf` — manual con secciones nuevas marcadas
- ✅ `CHANGELOG.md` (root) — entrada V4.0

**Plan Z** (kebab-case, vía `scripts/respaldar.sh`):
- ✅ Mismo conjunto replicado.

---

> 🔔 **Nota para el próximo agente**: lee este archivo PRIMERO si continúas después de la
> Fase 12. Te ahorra leer el SESSION_LOG entero para identificar qué cambió en V4.0.
