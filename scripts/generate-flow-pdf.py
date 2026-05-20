"""
Generate a presentation-style PDF of the HSBC Redirección flow.

Layout:
    - Landscape Letter, one logical "slide" per page.
    - Page 1   : Cover.
    - Page 2   : Rules / restrictions for the flow.
    - Pages 3-12: Steps 1-10, each with the mockup image on the left and the
      step's description / key points / user action on the right.

Run from the project root:
    python3 scripts/generate-flow-pdf.py
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from typing import Sequence

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.pdfgen.canvas import Canvas
from PIL import Image

# ────────────────────────── Content (mirrors drizzle/0006_seed_redireccion_flow.sql) ──

HSBC_RED = HexColor("#DB0011")
SOFT_GRAY = HexColor("#F5F5F5")
TEXT_DARK = HexColor("#1A1A1A")
TEXT_MUTED = HexColor("#666666")
TEXT_LIGHT = HexColor("#999999")

FLOW_NAME = "Redirección para clientes"
FLOW_SUBTITLE = (
    "Flujo de comunicación cuando la tarjeta es redireccionada a otra "
    "sucursal o dirección."
)

RULES: list[tuple[str, list[str]]] = [
    (
        "Restricciones por tipo de tarjeta",
        [
            "No aplica para tarjetas de Débito.",
            "No aplica para tarjetas TITANIUM.",
            "No aplica para Altas Nuevas ni Adicionales.",
        ],
    ),
    (
        "Restricciones geográficas",
        [
            "Solo se permite redirección dentro del mismo estado.",
            "Excepción: entre CDMX y Estado de México se permite redirección en ambas direcciones (Área Metropolitana).",
            "Restricción especial: bloqueada hacia/desde Puebla por fraude.",
        ],
    ),
    (
        "Requisitos de contacto",
        [
            "El TH debe tener ambos medios de contacto registrados (email y teléfono).",
            "Si inicia el flujo por SMS, debe recibir OTP por email y viceversa.",
        ],
    ),
]


@dataclass(frozen=True)
class Step:
    n: int
    title: str
    description: str
    key_points: tuple[str, ...]
    user_action: str
    mockup: str  # filename inside public/flows/redireccion/


STEPS: tuple[Step, ...] = (
    Step(
        1,
        "SMS de notificación",
        "El cliente recibe un SMS informando que su tarjeta ha sido enviada con un enlace para rastrearla.",
        (
            "El cliente recibe un SMS automático.",
            "Incluye enlace de rastreo a Kublau.",
            "Se envía al detectar que la tarjeta fue generada.",
        ),
        "El cliente da clic en el enlace del SMS.",
        "01-sms-notificacion.png",
    ),
    Step(
        2,
        "Email de tránsito",
        "Se envía un correo electrónico informando que la tarjeta ha sido generada con la dirección de entrega.",
        (
            "Email real enviado al cliente.",
            "Incluye código de rastreo y dirección registrada.",
            "Botón para actualizar domicilio de entrega.",
            "Contacto de soporte: 55 5721 1168.",
        ),
        "El cliente da clic en “Actualizar mi domicilio de entrega”.",
        "02-email-transito.png",
    ),
    Step(
        3,
        "Advertencia de seguridad",
        "Al ingresar al enlace, se muestra una advertencia informando que el sitio no solicitará datos privados.",
        (
            "Advertencia de privacidad obligatoria.",
            "Informa que nunca se piden datos sensibles.",
            "Servicio operado por tercero a solicitud de HSBC.",
        ),
        "El cliente da clic en “Continuar”.",
        "03-advertencia.png",
    ),
    Step(
        4,
        "Verificar dirección actual",
        "El cliente verifica la dirección de entrega actual y puede optar por cambiarla.",
        (
            "Se muestra la dirección actual de entrega.",
            "Aviso de restricción: solo mismo estado o zona metropolitana.",
            "Si necesita otro estado, debe llamar al 55 5721 1188 opc 2.",
        ),
        "El cliente da clic en “Quiero cambiar mi dirección de entrega”.",
        "04-verificar-direccion.png",
    ),
    Step(
        5,
        "Verificación de seguridad",
        "Se envía un código de verificación al correo electrónico registrado del cliente.",
        (
            "Envío de OTP al correo registrado.",
            "El código puede demorar hasta 1 minuto.",
            "Solo se puede generar el código 2 veces.",
            "Si no tiene acceso al correo, debe llamar o ir a sucursal.",
        ),
        "El cliente da clic en “Enviar código”.",
        "05-verificacion-seguridad.png",
    ),
    Step(
        6,
        "Ingresar código",
        "El cliente ingresa el código de verificación recibido por SMS o email.",
        (
            "Campo de 6 dígitos para el OTP.",
            "Si inició por SMS, el OTP llega por email y viceversa.",
            "Validación en tiempo real del código.",
            "Timer de reenvío y aviso para revisar spam.",
        ),
        "El cliente ingresa el código de 6 dígitos y confirma.",
        "06-ingresar-codigo.png",
    ),
    Step(
        7,
        "Ingresar nueva dirección",
        "El cliente llena un formulario con la nueva dirección de entrega para su tarjeta.",
        (
            "Formulario completo de nueva dirección.",
            "Validación automática de código postal.",
            "Campos: calle, número ext/int, CP, colonia, ciudad, estado.",
            "Campo de indicaciones y referencias.",
        ),
        "El cliente llena el formulario y da clic en “Guardar mi dirección”.",
        "07-ingresar-direccion.png",
    ),
    Step(
        8,
        "Confirmar dirección",
        "El cliente revisa y confirma la nueva dirección de entrega antes de proceder.",
        (
            "Resumen de la nueva dirección ingresada.",
            "Última oportunidad de corregir antes de confirmar.",
            "Si no es correcta, puede regresar a modificar.",
        ),
        "El cliente da clic en “Confirmar”.",
        "08-confirmar-direccion.png",
    ),
    Step(
        9,
        "Redirección exitosa",
        "Se confirma que la solicitud de redirección fue procesada exitosamente con un número de folio.",
        (
            "Se genera un folio de seguimiento.",
            "También se envía confirmación por email.",
            "Tiempo de entrega: 5 a 10 días hábiles.",
            "Contacto de soporte: 55 5721 1188 opc 2.",
        ),
        "Fin del flujo web. El cliente puede cerrar la página.",
        "09-redireccion-exitosa.png",
    ),
    Step(
        10,
        "Confirmación por email y SMS",
        "El cliente recibe confirmación final por correo electrónico y SMS con el folio de su solicitud.",
        (
            "Email de confirmación con folio y nueva dirección.",
            "SMS de confirmación enviado simultáneamente.",
            "Incluye datos de contacto para dudas.",
            "Footer con info legal de HSBC y Kublau.",
        ),
        "El cliente recibe la confirmación. No requiere acción adicional.",
        "10-email-confirmacion.png",
    ),
)


# ────────────────────────── Page layout helpers ─────────────────────────────────

PAGE_SIZE = landscape(letter)  # 792 × 612 pt
PAGE_W, PAGE_H = PAGE_SIZE
MARGIN = 0.5 * inch


def draw_header_bar(c: Canvas, total_steps: int, step_idx: int | None = None) -> None:
    """Thin red top bar + footer page label, shared across content pages."""
    # Top accent stripe.
    c.setFillColor(HSBC_RED)
    c.rect(0, PAGE_H - 6, PAGE_W, 6, stroke=0, fill=1)

    # Tiny wordmark on the top-right.
    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica-Bold", 8)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 20, "HSBC · KUBLAU")

    # Footer page counter.
    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica", 8)
    if step_idx is not None:
        c.drawString(MARGIN, 18, f"Paso {step_idx} de {total_steps}")
    c.drawRightString(PAGE_W - MARGIN, 18, "Flujo: Redirección para clientes")


def wrap_text(c: Canvas, text: str, font: str, size: float, max_width: float) -> list[str]:
    """Word-wrap to fit max_width using the current canvas font metrics."""
    c.setFont(font, size)
    words = text.split()
    if not words:
        return [""]
    lines: list[str] = []
    current = words[0]
    for w in words[1:]:
        trial = f"{current} {w}"
        if c.stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = w
    lines.append(current)
    return lines


def draw_wrapped(
    c: Canvas,
    text: str,
    x: float,
    y: float,
    max_width: float,
    *,
    font: str = "Helvetica",
    size: float = 11,
    line_height: float = 1.4,
    color: colors.Color = TEXT_DARK,
) -> float:
    """Draw word-wrapped text and return the y-coordinate after the last line."""
    c.setFillColor(color)
    c.setFont(font, size)
    lines = wrap_text(c, text, font, size, max_width)
    leading = size * line_height
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_image_fit(
    c: Canvas,
    path: str,
    x: float,
    y: float,
    box_w: float,
    box_h: float,
    *,
    align_top: bool = True,
) -> None:
    """Draw image inside (x, y, box_w, box_h) preserving aspect ratio."""
    img = Image.open(path)
    w, h = img.size
    ratio = min(box_w / w, box_h / h)
    draw_w, draw_h = w * ratio, h * ratio
    draw_x = x + (box_w - draw_w) / 2
    if align_top:
        draw_y = (y + box_h) - draw_h
    else:
        draw_y = y + (box_h - draw_h) / 2
    c.drawImage(
        path,
        draw_x,
        draw_y,
        width=draw_w,
        height=draw_h,
        preserveAspectRatio=True,
        mask="auto",
    )


# ────────────────────────── Cover ─────────────────────────────────────────────

def draw_cover(c: Canvas) -> None:
    # Big red block on the left third.
    band_w = PAGE_W * 0.32
    c.setFillColor(HSBC_RED)
    c.rect(0, 0, band_w, PAGE_H, stroke=0, fill=1)

    # "HSBC" inside the band.
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 60)
    c.drawString(MARGIN, PAGE_H * 0.55, "HSBC")
    c.setFont("Helvetica", 14)
    c.drawString(MARGIN, PAGE_H * 0.55 - 24, "Centro de Notificaciones")

    # Right side: title block.
    content_x = band_w + MARGIN
    content_w = PAGE_W - content_x - MARGIN

    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(content_x, PAGE_H - 1.4 * inch, "DOCUMENTACIÓN DEL FLUJO")

    c.setFillColor(TEXT_DARK)
    c.setFont("Helvetica-Bold", 38)
    c.drawString(content_x, PAGE_H - 2.0 * inch, FLOW_NAME)

    # Underline accent.
    c.setStrokeColor(HSBC_RED)
    c.setLineWidth(3)
    c.line(
        content_x,
        PAGE_H - 2.15 * inch,
        content_x + 1.6 * inch,
        PAGE_H - 2.15 * inch,
    )

    draw_wrapped(
        c,
        FLOW_SUBTITLE,
        content_x,
        PAGE_H - 2.6 * inch,
        content_w,
        font="Helvetica",
        size=16,
        line_height=1.4,
        color=TEXT_MUTED,
    )

    # Bullet summary of what the deck covers.
    items = [
        "Reglas y restricciones del flujo.",
        f"{len(STEPS)} pasos del journey, paso a paso.",
        "Mockups reales de cada pantalla.",
        "Acción esperada del cliente en cada paso.",
    ]
    y = PAGE_H - 4.0 * inch
    c.setFillColor(TEXT_DARK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(content_x, y, "EN ESTA PRESENTACIÓN")
    y -= 18
    c.setFont("Helvetica", 12)
    c.setFillColor(TEXT_MUTED)
    for item in items:
        c.setFillColor(HSBC_RED)
        c.circle(content_x + 4, y + 4, 2.2, stroke=0, fill=1)
        c.setFillColor(TEXT_MUTED)
        c.drawString(content_x + 14, y, item)
        y -= 18

    # Bottom branding.
    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica", 9)
    c.drawString(content_x, 0.5 * inch, "Kublau · Centro de Notificaciones HSBC")
    c.drawRightString(PAGE_W - MARGIN, 0.5 * inch, "Presentación interna")


# ────────────────────────── Rules page ────────────────────────────────────────

def draw_rules_page(c: Canvas) -> None:
    draw_header_bar(c, total_steps=len(STEPS))

    # Header.
    y = PAGE_H - 0.85 * inch
    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGIN, y, "ANTES DE EMPEZAR")
    y -= 26
    c.setFillColor(TEXT_DARK)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(MARGIN, y, "Reglas y restricciones del flujo")

    # 3-column rules layout.
    inner_top = y - 0.5 * inch
    col_w = (PAGE_W - 2 * MARGIN - 2 * 0.3 * inch) / 3
    col_h = inner_top - 1.0 * inch  # space until footer

    for i, (title, items) in enumerate(RULES):
        col_x = MARGIN + i * (col_w + 0.3 * inch)
        # Card background.
        c.setFillColor(SOFT_GRAY)
        c.roundRect(col_x, inner_top - col_h, col_w, col_h, 8, stroke=0, fill=1)
        # Top accent strip.
        c.setFillColor(HSBC_RED)
        c.rect(col_x, inner_top - 4, col_w, 4, stroke=0, fill=1)

        # Title.
        ty = inner_top - 28
        c.setFillColor(TEXT_DARK)
        c.setFont("Helvetica-Bold", 13)
        for line in wrap_text(c, title, "Helvetica-Bold", 13, col_w - 24):
            c.drawString(col_x + 12, ty, line)
            ty -= 18

        # Items.
        ty -= 8
        for item in items:
            # Red dot.
            c.setFillColor(HSBC_RED)
            c.circle(col_x + 16, ty + 4, 2.2, stroke=0, fill=1)
            # Item text.
            after = draw_wrapped(
                c,
                item,
                col_x + 24,
                ty,
                col_w - 36,
                font="Helvetica",
                size=10.5,
                line_height=1.35,
                color=TEXT_DARK,
            )
            ty = after - 6


# ────────────────────────── Step pages ───────────────────────────────────────

def draw_step_page(c: Canvas, step: Step, total_steps: int, mockups_dir: str) -> None:
    draw_header_bar(c, total_steps=total_steps, step_idx=step.n)

    # ── Left column: mockup ────────────────────────────────────────────────
    left_w = PAGE_W * 0.40
    img_box_x = MARGIN
    img_box_y = MARGIN + 0.3 * inch
    img_box_w = left_w - MARGIN
    img_box_h = PAGE_H - 1.5 * inch
    image_path = os.path.join(mockups_dir, step.mockup)
    draw_image_fit(c, image_path, img_box_x, img_box_y, img_box_w, img_box_h)

    # ── Right column: content ─────────────────────────────────────────────
    right_x = left_w + MARGIN
    right_w = PAGE_W - right_x - MARGIN

    # Step number badge.
    badge_y = PAGE_H - 0.95 * inch
    c.setFillColor(HSBC_RED)
    c.roundRect(right_x, badge_y, 1.0 * inch, 22, 11, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(right_x + 0.5 * inch, badge_y + 6, f"PASO {step.n} / {total_steps}")

    # Title.
    title_y = badge_y - 0.45 * inch
    c.setFillColor(TEXT_DARK)
    c.setFont("Helvetica-Bold", 26)
    title_lines = wrap_text(c, step.title, "Helvetica-Bold", 26, right_w)
    for line in title_lines:
        c.drawString(right_x, title_y, line)
        title_y -= 32

    # Accent underline.
    c.setStrokeColor(HSBC_RED)
    c.setLineWidth(2)
    c.line(right_x, title_y + 18, right_x + 0.9 * inch, title_y + 18)

    # Description.
    desc_y = title_y - 12
    desc_y = draw_wrapped(
        c,
        step.description,
        right_x,
        desc_y,
        right_w,
        font="Helvetica",
        size=13,
        line_height=1.45,
        color=TEXT_MUTED,
    )

    # Key points section.
    kp_y = desc_y - 14
    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(right_x, kp_y, "PUNTOS CLAVE")
    kp_y -= 18
    for item in step.key_points:
        c.setFillColor(HSBC_RED)
        c.circle(right_x + 4, kp_y + 4, 2.2, stroke=0, fill=1)
        kp_y = draw_wrapped(
            c,
            item,
            right_x + 14,
            kp_y,
            right_w - 14,
            font="Helvetica",
            size=11,
            line_height=1.4,
            color=TEXT_DARK,
        )
        kp_y -= 4

    # User action callout.
    callout_h = 64
    callout_y = MARGIN + 0.45 * inch
    c.setFillColor(SOFT_GRAY)
    c.roundRect(right_x, callout_y, right_w, callout_h, 8, stroke=0, fill=1)
    # Left accent stripe.
    c.setFillColor(HSBC_RED)
    c.rect(right_x, callout_y, 4, callout_h, stroke=0, fill=1)
    # Label.
    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(right_x + 14, callout_y + callout_h - 18, "ACCIÓN DEL USUARIO")
    # Text.
    draw_wrapped(
        c,
        step.user_action,
        right_x + 14,
        callout_y + callout_h - 34,
        right_w - 28,
        font="Helvetica",
        size=11,
        line_height=1.35,
        color=TEXT_DARK,
    )


# ────────────────────────── Main ──────────────────────────────────────────────

def main() -> int:
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    mockups_dir = os.path.join(project_root, "public", "flows", "redireccion")
    output_path = os.path.join(project_root, "flujo-redireccion-presentacion.pdf")

    # Sanity check the mockups exist.
    missing: list[str] = [
        s.mockup for s in STEPS if not os.path.exists(os.path.join(mockups_dir, s.mockup))
    ]
    if missing:
        print(f"Missing mockup files in {mockups_dir}:", file=sys.stderr)
        for m in missing:
            print(f"  - {m}", file=sys.stderr)
        return 1

    c = canvas.Canvas(output_path, pagesize=PAGE_SIZE)
    c.setTitle("Redirección para clientes — HSBC")
    c.setAuthor("Kublau · Centro de Notificaciones")
    c.setSubject("Documentación del flujo de redirección")

    # Cover removed per Raúl's request — readers go straight to the rules
    # page. draw_cover() is kept available in case we want to bring it back.

    # Rules.
    draw_rules_page(c)
    c.showPage()

    # Steps.
    for step in STEPS:
        draw_step_page(c, step, total_steps=len(STEPS), mockups_dir=mockups_dir)
        c.showPage()

    c.save()
    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
