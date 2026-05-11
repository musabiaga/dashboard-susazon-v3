#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sincroniza /docs del repo (V1 actualizada) → carpeta V2.0 con kebab-case.
Respalda las 5 sesiones JSONL del proyecto.
Valida checksums md5 (cada archivo 2x: en origen y en destino).
"""

import hashlib
import shutil
from pathlib import Path

SRC_REPO = Path("/Users/mauusabiaga/Downloads/DASHBOARD SEMANAL VENTAS V3.0 [Claude Code]")
DST_V2 = Path("/Users/mauusabiaga/Downloads/DASHBOARD SEMANAL VENTAS V3.0 [Claude Code] [Respaldo Profesional Plan Z]")
SESSIONS_SRC = Path("/Users/mauusabiaga/.claude/projects/-Users-mauusabiaga-Desktop-Claude-Code-PROJECTS-")

# Mapeo de nombres origen → destino (kebab-case según V2.0)
DOC_RENAME = {
    "00_INDICE_MAESTRO.md": "00_indice-maestro.md",
    "01_Arquitectura_Tecnica.docx": "01_arquitectura-tecnica.docx",
    "02_Diccionario_Datos.docx": "02_diccionario-datos.docx",
    "03_ChangeLog_Release_Notes.docx": "03_changelog-release-notes.docx",
    "04_Manual_Usuario.docx": "04_manual-usuario.docx",
    "05_Guia_TI_Despliegue.docx": "05_guia-ti-despliegue.docx",
    "06_Guia_Reconstruccion.docx": "06_guia-reconstruccion.docx",
    "AUTH_FLOWS.md": "auth-flows.md",
    "CONTINUACION_NUEVA_CONVERSACION.md": "continuacion-nueva-conversacion.md",
    "INSTRUCTIVO_AGENTE.xml": "INSTRUCTIVO_AGENTE.xml",  # se mantiene mayúsculas
    "Instructivo_Usuario_Visual.html": "instructivo-usuario-visual.html",
    "Instructivo_Usuario_Visual.pdf": "instructivo-usuario-visual.pdf",
    "SESSION_LOG.md": "SESSION_LOG.md",  # se mantiene mayúsculas
}


def md5sum(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def copy_with_validation(src: Path, dst: Path, label: str):
    """Copia con validación md5 doble (después de copy + verificación final)."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    src_md5 = md5sum(src)
    shutil.copy2(src, dst)
    # Validación 1: inmediatamente después del copy
    post_md5_1 = md5sum(dst)
    if src_md5 != post_md5_1:
        raise RuntimeError(f"FAIL validación 1 para {label}: {src_md5} != {post_md5_1}")
    # Validación 2: re-leer y verificar de nuevo (defensa contra caché)
    post_md5_2 = md5sum(dst)
    if src_md5 != post_md5_2:
        raise RuntimeError(f"FAIL validación 2 para {label}: {src_md5} != {post_md5_2}")
    return src_md5, src.stat().st_size


def main():
    rows = []

    print("=" * 70)
    print("Fase 6: Sync /docs del repo → /docs de V2.0 con kebab-case")
    print("=" * 70)
    src_docs = SRC_REPO / "docs"
    dst_docs = DST_V2 / "docs"

    for old_name, new_name in DOC_RENAME.items():
        src = src_docs / old_name
        if not src.exists():
            print(f"  ⚠ {old_name} NO existe en origen — skipped")
            continue
        dst = dst_docs / new_name
        md5, size = copy_with_validation(src, dst, old_name)
        rows.append((old_name, new_name, size, md5, "OK"))
        print(f"  ✓ {old_name:50s} → {new_name:45s} ({size//1024:6} KB) MD5: {md5[:16]}…")

    print("\n" + "=" * 70)
    print("Fase 7: Respaldar 5 sesiones JSONL → /sessions de V2.0")
    print("=" * 70)
    dst_sessions = DST_V2 / "sessions"

    if SESSIONS_SRC.exists():
        jsonl_files = sorted(SESSIONS_SRC.glob("*.jsonl"))
        for src in jsonl_files:
            # Nombre más legible: añadir prefijo con tamaño y fecha
            stat = src.stat()
            from datetime import datetime
            mod_date = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d_%H%M%S")
            size_mb = stat.st_size / 1024 / 1024
            new_name = f"{mod_date}_session_{src.stem[:8]}.jsonl"
            dst = dst_sessions / new_name
            md5, size = copy_with_validation(src, dst, src.name)
            rows.append((f"sessions/{src.name}", f"sessions/{new_name}", size, md5, "OK"))
            print(f"  ✓ {src.name[:40]:40s} → {new_name:50s} ({size_mb:6.1f} MB) MD5: {md5[:16]}…")
    else:
        print(f"  ⚠ No existe {SESSIONS_SRC}")

    print("\n" + "=" * 70)
    print("Fase 8: Copiar root files del proyecto a /src del V2.0 (snapshot código)")
    print("=" * 70)
    # Snapshot del código clave (algunos archivos representativos)
    src_files = [
        "AGENTS.md",
        "CLAUDE.md",
        "README.md",
        "package.json",
        "package-lock.json",
        "tsconfig.json",
        "next.config.ts",
        "proxy.ts",
    ]
    dst_src = DST_V2 / "src"
    for fname in src_files:
        src = SRC_REPO / fname
        if not src.exists():
            continue
        dst = dst_src / fname
        md5, size = copy_with_validation(src, dst, fname)
        rows.append((f"src/{fname}", f"src/{fname}", size, md5, "OK"))
        print(f"  ✓ {fname:30s} ({size//1024:6} KB)")

    # Migraciones SQL → /data del V2.0 (como referencia)
    migrations_dir = SRC_REPO / "supabase" / "migrations"
    if migrations_dir.exists():
        dst_data = DST_V2 / "data" / "migrations"
        for mig in sorted(migrations_dir.glob("*.sql")):
            dst = dst_data / mig.name
            md5, size = copy_with_validation(mig, dst, mig.name)
            rows.append((f"data/migrations/{mig.name}", f"data/migrations/{mig.name}", size, md5, "OK"))
        print(f"  ✓ {len(list(migrations_dir.glob('*.sql')))} migraciones SQL copiadas a /data/migrations/")

    # Scripts de generación de docs → /scripts del V2.0
    scripts_dir = SRC_REPO / "scripts"
    if scripts_dir.exists():
        dst_scripts = DST_V2 / "scripts"
        for s in sorted(scripts_dir.glob("*.py")):
            dst = dst_scripts / s.name
            md5, size = copy_with_validation(s, dst, s.name)
            rows.append((f"scripts/{s.name}", f"scripts/{s.name}", size, md5, "OK"))
        print(f"  ✓ {len(list(scripts_dir.glob('*.py')))} scripts Python copiados a /scripts/")

    # Reporte final
    print("\n" + "=" * 70)
    print("REPORTE FINAL — Validación doble de checksums")
    print("=" * 70)
    print(f"Total archivos respaldados: {len(rows)}")
    print(f"Total OK: {sum(1 for r in rows if r[4] == 'OK')}")
    print(f"Total bytes: {sum(r[2] for r in rows):,} ({sum(r[2] for r in rows)/1024/1024:.1f} MB)")
    print(f"\nEstrategia: cada archivo verificado MD5 2x (post-copy + re-read).")
    print(f"Si algún archivo falló, el script habría abortado con RuntimeError.")
    print("\n✅ BACKUP COMPLETO con validación doble exitosa.")


if __name__ == "__main__":
    main()
