#!/usr/bin/env bash
# ============================================================================
# respaldar.sh — Sincroniza el proyecto principal hacia el Plan Z (respaldo)
# ============================================================================
#
# Propósito: con un solo comando, dejar el Plan Z al 100% al día con la
# carpeta principal. Cubre código + docs + sesiones Claude (JSONLs).
#
# Uso:
#   ./scripts/respaldar.sh                # sync normal
#   ./scripts/respaldar.sh --dry-run      # solo muestra qué haría, sin tocar
#   ./scripts/respaldar.sh --con-notes    # además, recordatorio para Apple Notes
#   ./scripts/respaldar.sh --con-db       # además, dump de Supabase a Plan Z/db-backups/
#
# Lo que respalda:
#   - Código: app/, components/, lib/, hooks/, public/, scripts/, supabase/, types/
#   - Configs: package.json, tsconfig.json, next.config.ts, .env.example, .gitignore,
#              proxy.ts, AGENTS.md
#   - Docs: todo /docs/ con renombre kebab-case automático en Plan Z
#   - Sesiones Claude: JSONLs desde ~/.claude/projects/... copiados a
#                       <principal>/sessions/ Y <plan z>/sessions/
#
# Lo que NO respalda (intencional):
#   - node_modules/, .next/, .git/, .DS_Store (regenerables / no útiles)
#   - .env.local (secrets — viven en SECRETS_DASHBOARD_V3.txt + Apple Notes)
#
# Autor: Mauricio Usabiaga + Claude · Fecha de creación: 2026-05-17
# ============================================================================

set -euo pipefail

# ----------------------- Configuración ----------------------------
PRINCIPAL="/Users/mauusabiaga/Desktop/Downloads Seleccionados/DASHBOARD SEMANAL VENTAS V3.0 [Claude Code]"
PLANZ="/Users/mauusabiaga/Desktop/Downloads Seleccionados/DASHBOARD SEMANAL VENTAS V3.0 [Claude Code] [Respaldo Profesional Plan Z]"
CLAUDE_PROJECTS="/Users/mauusabiaga/.claude/projects/-Users-mauusabiaga-Desktop-Claude-Code-PROJECTS-"

# ----------------------- Flags ------------------------------------
DRY_RUN=false
CON_DB=false
CON_NOTES=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)    DRY_RUN=true ;;
    --con-db)     CON_DB=true ;;
    --con-notes)  CON_NOTES=true ;;
    --help|-h)
      head -30 "$0" | tail -27
      exit 0
      ;;
    *)
      echo "❌ Flag desconocido: $arg"
      echo "   Usa --help para ver opciones."
      exit 1
      ;;
  esac
done

# ----------------------- Colores y helpers ------------------------
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "${GRAY}  $*${NC}"; }
ok()      { echo -e "${GREEN}✓${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
err()     { echo -e "${RED}✗${NC} $*"; }
title()   { echo -e "\n${BOLD}${BLUE}━━ $* ━━${NC}"; }

if $DRY_RUN; then
  RSYNC_FLAGS="-av --dry-run"
  warn "MODO DRY-RUN — nada se va a modificar. Solo te muestro qué haría."
else
  RSYNC_FLAGS="-av"
fi

# Verificaciones preliminares
[ -d "$PRINCIPAL" ] || { err "Carpeta PRINCIPAL no existe: $PRINCIPAL"; exit 1; }
[ -d "$PLANZ" ]     || { err "Carpeta PLAN Z no existe: $PLANZ";       exit 1; }

# ----------------------- 1. Código (con exclusiones) --------------
title "1. Sincronizando código (app/, components/, lib/, hooks/, etc.)"

CODE_DIRS=(app components lib hooks public scripts supabase types)
for dir in "${CODE_DIRS[@]}"; do
  if [ -d "$PRINCIPAL/$dir" ]; then
    log "→ $dir/"
    rsync $RSYNC_FLAGS --delete \
      --exclude='node_modules' \
      --exclude='.next' \
      --exclude='.DS_Store' \
      --exclude='*.tsbuildinfo' \
      "$PRINCIPAL/$dir/" "$PLANZ/$dir/" 2>&1 | tail -3 | sed 's/^/    /'
  fi
done

# ----------------------- 2. Archivos root individuales ------------
title "2. Sincronizando archivos root (configs)"

ROOT_FILES=(package.json package-lock.json tsconfig.json next.config.ts proxy.ts .env.example .gitignore AGENTS.md)
for f in "${ROOT_FILES[@]}"; do
  if [ -f "$PRINCIPAL/$f" ]; then
    if $DRY_RUN; then
      log "[dry] copy $f"
    else
      cp -p "$PRINCIPAL/$f" "$PLANZ/$f"
      ok "$f"
    fi
  fi
done

# ----------------------- 3. Docs con kebab-case rename ------------
title "3. Sincronizando /docs/ con renombre a kebab-case"

# Mapping vía función (compatible bash 3.2 de macOS — no usa associative arrays).
# SESSION_LOG.md y INSTRUCTIVO_AGENTE.xml conservan nombre canónico en CAPS
# (señal de "documento vivo crítico").
kebab_name_for() {
  case "$1" in
    "00_INDICE_MAESTRO.md")              echo "00_indice-maestro.md" ;;
    "01_Arquitectura_Tecnica.docx")      echo "01_arquitectura-tecnica.docx" ;;
    "02_Diccionario_Datos.docx")         echo "02_diccionario-datos.docx" ;;
    "03_ChangeLog_Release_Notes.docx")   echo "03_changelog-release-notes.docx" ;;
    "04_Manual_Usuario.docx")            echo "04_manual-usuario.docx" ;;
    "05_Guia_TI_Despliegue.docx")        echo "05_guia-ti-despliegue.docx" ;;
    "06_Guia_Reconstruccion.docx")       echo "06_guia-reconstruccion.docx" ;;
    "AUTH_FLOWS.md")                     echo "auth-flows.md" ;;
    "GUIA_OBTENER_SECRETS.md")           echo "guia-obtener-secrets.md" ;;
    "CONTINUACION_NUEVA_CONVERSACION.md") echo "continuacion-nueva-conversacion.md" ;;
    "Instructivo_Usuario_Visual.html")   echo "instructivo-usuario-visual.html" ;;
    "Instructivo_Usuario_Visual.pdf")    echo "instructivo-usuario-visual.pdf" ;;
    "LO_NUEVO.md")                       echo "lo-nuevo.md" ;;
    *)                                   echo "$1" ;;
  esac
}

mkdir -p "$PLANZ/docs"
for src in "$PRINCIPAL/docs/"*; do
  [ -f "$src" ] || continue
  fname=$(basename "$src")
  dst_name=$(kebab_name_for "$fname")
  dst="$PLANZ/docs/$dst_name"

  if $DRY_RUN; then
    log "[dry] $fname → docs/$dst_name"
  else
    cp -p "$src" "$dst"
    log "$fname → docs/$dst_name"
  fi
done
ok "/docs/ sincronizada"

# ----------------------- 4. Sesiones Claude JSONL -----------------
title "4. Sincronizando sesiones Claude (JSONLs)"

if [ ! -d "$CLAUDE_PROJECTS" ]; then
  warn "No encontré $CLAUDE_PROJECTS — skip sesiones."
else
  mkdir -p "$PRINCIPAL/sessions" "$PLANZ/sessions"
  count=0
  for src_jsonl in "$CLAUDE_PROJECTS"/*.jsonl; do
    [ -f "$src_jsonl" ] || continue
    hash=$(basename "$src_jsonl" .jsonl | cut -c1-8)
    # Usar mtime del archivo como fecha de respaldo en el nombre
    mtime=$(stat -f "%Sm" -t "%Y-%m-%d_%H%M%S" "$src_jsonl")
    dst_name="${mtime}_session_${hash}.jsonl"

    # Buscar si ya existe alguna versión de este hash en sessions/
    # (|| true: con set -o pipefail+errexit, `ls` sin match aborta el script
    #  la primera vez que se respalda una sesión nueva — este guard lo evita).
    existing=$(ls "$PRINCIPAL/sessions/"*"_session_${hash}.jsonl" 2>/dev/null | head -1 || true)
    if [ -n "$existing" ]; then
      dst_name=$(basename "$existing")
    fi

    if $DRY_RUN; then
      log "[dry] $hash → sessions/$dst_name"
    else
      cp -p "$src_jsonl" "$PRINCIPAL/sessions/$dst_name"
      cp -p "$src_jsonl" "$PLANZ/sessions/$dst_name"
    fi
    count=$((count + 1))
  done
  ok "$count sesiones JSONL copiadas a ambas carpetas"
fi

# ----------------------- 5. Actualizar CHANGELOG.md de Plan Z -----
title "5. Actualizando CHANGELOG.md root de Plan Z"

if [ -f "$PLANZ/CHANGELOG.md" ]; then
  last_commit=$(cd "$PRINCIPAL" && git log --oneline -1 2>/dev/null || echo "(no git)")
  today=$(date "+%Y-%m-%d %H:%M")

  if $DRY_RUN; then
    log "[dry] Actualizaría header de sync con: $today · $last_commit"
  else
    # Estrategia simple: si ya hay una línea de "Última sincronización", la reemplaza.
    # Si no, la inserta después del título principal del archivo.
    tmpfile=$(mktemp)
    awk -v sync_line="> 🔄 **Última sincronización con principal:** $today · commit \`$last_commit\`" '
      BEGIN { inserted = 0; skipped_prev = 0 }
      # Saltar la línea de sync previa (y posibles líneas en blanco adyacentes)
      /^> 🔄 \*\*Última sincronización con principal/ { skipped_prev = 1; next }
      # Insertar después del primer header H1
      !inserted && /^# / {
        print
        print ""
        print sync_line
        inserted = 1
        next
      }
      { print }
    ' "$PLANZ/CHANGELOG.md" > "$tmpfile"
    mv "$tmpfile" "$PLANZ/CHANGELOG.md"
    ok "CHANGELOG.md actualizado"
  fi
fi

# ----------------------- 6. Dump DB (opcional) --------------------
if $CON_DB; then
  title "6. Dump de Supabase a Plan Z/db-backups/"

  if ! command -v pg_dump >/dev/null 2>&1; then
    err "pg_dump no está instalado. Instálalo con: brew install postgresql"
    err "  (o pídeme que use otro método — por ejemplo Supabase CLI)"
  else
    if [ -f "$PRINCIPAL/.env.local" ]; then
      # Leer DATABASE_URL del .env.local sin exportarla al shell
      DB_URL=$(grep "^DATABASE_URL=" "$PRINCIPAL/.env.local" | head -1 | cut -d'=' -f2- | tr -d '"')
      if [ -n "$DB_URL" ]; then
        mkdir -p "$PLANZ/db-backups"
        dump_file="$PLANZ/db-backups/$(date +%Y-%m-%d_%H%M)_dump.sql.gz"
        if $DRY_RUN; then
          log "[dry] pg_dump → $dump_file"
        else
          log "Ejecutando pg_dump (tarda ~30s para 337K filas)..."
          pg_dump "$DB_URL" | gzip > "$dump_file"
          ok "Dump guardado: $(basename "$dump_file") ($(du -h "$dump_file" | cut -f1))"

          # Mantener solo los últimos 12 dumps, borrar los más viejos
          dumps=("$PLANZ/db-backups"/*.sql.gz)
          if [ ${#dumps[@]} -gt 12 ]; then
            ls -t "$PLANZ/db-backups"/*.sql.gz | tail -n +13 | xargs rm -f
            log "Rotación: mantengo los 12 dumps más recientes"
          fi
        fi
      else
        warn "No encontré DATABASE_URL en .env.local — skip dump"
      fi
    else
      warn ".env.local no existe — skip dump"
    fi
  fi
fi

# ----------------------- 7. Recordatorio Notes (opcional) ---------
if $CON_NOTES; then
  title "7. Recordatorio: actualizar Apple Notes"
  echo ""
  echo "  Las 12 notas de respaldo en Apple Notes (carpeta"
  echo "  'Dashboard Susazón V3.0 [backup del dashboard]') NO se"
  echo "  actualizan automáticamente. Si hubo cambios importantes en docs/,"
  echo "  pide a Claude (en una sesión nueva) actualizar las notas:"
  echo ""
  echo "  > \"Actualiza las notas de Apple Notes con los docs más recientes\""
  echo ""
fi

# ----------------------- Resumen final ----------------------------
title "✅ Resumen"

if $DRY_RUN; then
  warn "DRY-RUN completado. Nada fue modificado."
  echo "    Si todo se ve bien, corre el script sin --dry-run para aplicar."
else
  ok "Respaldo completo en: $PLANZ"
  echo ""
  log "Tamaño total Plan Z: $(du -sh "$PLANZ" 2>/dev/null | cut -f1)"
  log "Sesiones JSONL:      $(du -sh "$PLANZ/sessions" 2>/dev/null | cut -f1)"
  log "Última actualización: $(date '+%Y-%m-%d %H:%M')"
  echo ""
  echo "    Flags útiles para la próxima:"
  echo "      ./scripts/respaldar.sh --dry-run      # preview sin tocar nada"
  echo "      ./scripts/respaldar.sh --con-db       # incluye dump Supabase"
  echo "      ./scripts/respaldar.sh --con-notes    # recordatorio Notes"
fi

echo ""
