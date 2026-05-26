"""
Genera un PDF tipo presentación del flujo "Redirección para clientes" de HSBC.

Layout: landscape (A4), una pantalla por página.
- Portada
- Reglas / restricciones
- 10 pasos (mockup móvil a la izquierda, contenido a la derecha)

Contenido cargado desde drizzle/0006_seed_redireccion_flow.sql.
Imágenes desde public/flows/redireccion/.

Output: ./flujo-redireccion-presentacion.pdf
"""

from __future__ import annotations

import os
import re
import html
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Frame
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT

# ---- Constantes de diseño ------------------------------------------------

PAGE_W, PAGE_H = landscape(A4)  # 842 x 595 pt
HSBC_RED = HexColor("#DB0011")
HSBC_DARK = HexColor("#1A1A1A")
TEXT_GRAY = HexColor("#3F3F46")
SOFT_GRAY = HexColor("#71717A")
BG_SOFT = HexColor("#F4F4F5")
ACCENT_BG = HexColor("#FEF2F2")
BORDER = HexColor("#E4E4E7")

MARGIN = 28

OUTPUT = "flujo-redireccion-presentacion.pdf"
MOCKUPS_DIR = "public/flows/redireccion"

# ---- Estilos -------------------------------------------------------------

base_font = "Helvetica"
bold_font = "Helvetica-Bold"

style_h1 = ParagraphStyle(
    "h1", fontName=bold_font, fontSize=28, leading=32,
    textColor=HSBC_DARK, alignment=TA_LEFT,
)
style_h2 = ParagraphStyle(
    "h2", fontName=bold_font, fontSize=20, leading=24,
    textColor=HSBC_DARK, alignment=TA_LEFT, spaceAfter=4,
)
style_eyebrow = ParagraphStyle(
    "eyebrow", fontName=bold_font, fontSize=9, leading=12,
    textColor=HSBC_RED, alignment=TA_LEFT, spaceAfter=6,
)
style_subtitle = ParagraphStyle(
    "sub", fontName=base_font, fontSize=11, leading=15,
    textColor=TEXT_GRAY, alignment=TA_LEFT, spaceAfter=10,
)
style_section = ParagraphStyle(
    "section", fontName=bold_font, fontSize=10, leading=13,
    textColor=HSBC_RED, alignment=TA_LEFT, spaceAfter=4,
)
style_body = ParagraphStyle(
    "body", fontName=base_font, fontSize=10, leading=14,
    textColor=TEXT_GRAY, alignment=TA_LEFT, spaceAfter=4,
)
style_bullet = ParagraphStyle(
    "bullet", fontName=base_font, fontSize=9.5, leading=13,
    textColor=TEXT_GRAY, alignment=TA_LEFT, leftIndent=12,
    bulletIndent=0, spaceAfter=3,
)
style_action = ParagraphStyle(
    "action", fontName=bold_font, fontSize=10, leading=14,
    textColor=HSBC_DARK, alignment=TA_LEFT,
)
style_rule = ParagraphStyle(
    "rule", fontName=base_font, fontSize=10.5, leading=15,
    textColor=TEXT_GRAY, alignment=TA_LEFT, leftIndent=14,
    bulletIndent=0, spaceAfter=5,
)
style_footer = ParagraphStyle(
    "footer", fontName=base_font, fontSize=8, leading=10,
    textColor=SOFT_GRAY, alignment=TA_LEFT,
)


# ---- Contenido ----------------------------------------------------------

FLOW = {
    "name": "Redirección para clientes",
    "subtitle": "Flujo de comunicación cuando la tarjeta es redireccionada a otra sucursal o dirección.",
    "rules": [
        {
            "category": "Restricciones por tipo de tarjeta",
            "items": [
                "No aplica para tarjetas de <b>Débito</b>",
                "No aplica para tarjetas <b>TITANIUM</b>",
                "No aplica para <b>Altas Nuevas</b> ni <b>Adicionales</b>",
            ],
        },
        {
            "category": "Restricciones geográficas",
            "items": [
                "Solo se permite redirección <b>dentro del mismo estado</b>",
                "<b>Excepción:</b> entre CDMX y Estado de México se permite redirección en ambas direcciones (Área Metropolitana)",
                "<b>Restricción especial:</b> bloqueada hacia/desde <b>Puebla</b> por fraude",
            ],
        },
        {
            "category": "Requisitos de contacto",
            "items": [
                "El TH debe tener <b>ambos medios de contacto</b> registrados (email y teléfono)",
                "Si inicia el flujo por SMS, debe recibir OTP por email y viceversa",
            ],
        },
    ],
}

STEPS = [
    {
        "n": 1, "title": "SMS de notificación",
        "description": "El cliente recibe un SMS informando que su tarjeta ha sido enviada con un enlace para rastrearla.",
        "key_points": [
            "El cliente recibe un SMS automático",
            "Incluye enlace de rastreo a Kublau",
            "Se envía al detectar que la tarjeta fue generada",
        ],
        "user_action": "El cliente da clic en el enlace del SMS",
        "image": "01-sms-notificacion.png",
    },
    {
        "n": 2, "title": "Email de tránsito",
        "description": "Se envía un correo electrónico informando que la tarjeta ha sido generada con la dirección de entrega.",
        "key_points": [
            "Email real enviado al cliente",
            "Incluye código de rastreo y dirección registrada",
            "Botón para actualizar domicilio de entrega",
            "Contacto de soporte: 55 5721 1168",
        ],
        "user_action": "El cliente da clic en “Actualizar mi domicilio de entrega”",
        "image": "02-email-transito.png",
    },
    {
        "n": 3, "title": "Advertencia de seguridad",
        "description": "Al ingresar al enlace, se muestra una advertencia informando que el sitio no solicitará datos privados.",
        "key_points": [
            "Advertencia de privacidad obligatoria",
            "Informa que nunca se piden datos sensibles",
            "Servicio operado por tercero a solicitud de HSBC",
        ],
        "user_action": "El cliente da clic en “Continuar”",
        "image": "03-advertencia.png",
    },
    {
        "n": 4, "title": "Verificar dirección actual",
        "description": "El cliente verifica la dirección de entrega actual y puede optar por cambiarla.",
        "key_points": [
            "Se muestra la dirección actual de entrega",
            "Aviso de restricción: solo mismo estado o zona metropolitana",
            "Si necesita otro estado, debe llamar al 55 5721 1188 opc 2",
        ],
        "user_action": "El cliente da clic en “Quiero cambiar mi dirección de entrega”",
        "image": "04-verificar-direccion.png",
    },
    {
        "n": 5, "title": "Verificación de seguridad",
        "description": "Se envía un código de verificación al correo electrónico registrado del cliente.",
        "key_points": [
            "Envío de OTP al correo registrado",
            "El código puede demorar hasta 1 minuto",
            "Solo se puede generar el código 2 veces",
            "Si no tiene acceso al correo, debe llamar o ir a sucursal",
        ],
        "user_action": "El cliente da clic en “Enviar código”",
        "image": "05-verificacion-seguridad.png",
    },
    {
        "n": 6, "title": "Ingresar código",
        "description": "El cliente ingresa el código de verificación recibido por SMS o email.",
        "key_points": [
            "Campo de 6 dígitos para el OTP",
            "Si inició por SMS, el OTP llega por email y viceversa",
            "Validación en tiempo real del código",
            "Timer de reenvío y aviso para revisar spam",
        ],
        "user_action": "El cliente ingresa el código de 6 dígitos y confirma",
        "image": "06-ingresar-codigo.png",
    },
    {
        "n": 7, "title": "Ingresar nueva dirección",
        "description": "El cliente llena un formulario con la nueva dirección de entrega para su tarjeta.",
        "key_points": [
            "Formulario completo de nueva dirección",
            "Validación automática de código postal",
            "Campos: calle, número ext/int, CP, colonia, ciudad, estado",
            "Campo de indicaciones y referencias",
        ],
        "user_action": "El cliente llena el formulario y da clic en “Guardar mi dirección”",
        "image": "07-ingresar-direccion.png",
    },
    {
        "n": 8, "title": "Confirmar dirección",
        "description": "El cliente revisa y confirma la nueva dirección de entrega antes de proceder.",
        "key_points": [
            "Resumen de la nueva dirección ingresada",
            "Última oportunidad de corregir antes de confirmar",
            "Si no es correcta, puede regresar a modificar",
        ],
        "user_action": "El cliente da clic en “Confirmar”",
        "image": "08-confirmar-direccion.png",
    },
    {
        "n": 9, "title": "Redirección exitosa",
        "description": "Se confirma que la solicitud de redirección fue procesada exitosamente con un número de folio.",
        "key_points": [
            "Se genera un folio de seguimiento",
            "También se envía confirmación por email",
            "Tiempo de entrega: 5 a 10 días hábiles",
            "Contacto de soporte: 55 5721 1188 opc 2",
        ],
        "user_action": "Fin del flujo web. El cliente puede cerrar la página.",
        "image": "09-redireccion-exitosa.png",
    },
    {
        "n": 10, "title": "Confirmación por email y SMS",
        "description": "El cliente recibe confirmación final por correo electrónico y SMS con el folio de su solicitud.",
        "key_points": [
            "Email de confirmación con folio y nueva dirección",
            "SMS de confirmación enviado simultáneamente",
            "Incluye datos de contacto para dudas",
            "Footer con info legal de HSBC y Kublau",
        ],
        "user_action": "El cliente recibe la confirmación. No requiere acción adicional.",
        "image": "10-email-confirmacion.png",
    },
]


# ---- Helpers de dibujo --------------------------------------------------


def draw_top_bar(c: canvas.Canvas, eyebrow: str, page_num: int, total: int):
    """Barra superior con acento HSBC."""
    # Banda de acento
    c.setFillColor(HSBC_RED)
    c.rect(0, PAGE_H - 6, PAGE_W, 6, stroke=0, fill=1)

    # Eyebrow
    c.setFillColor(SOFT_GRAY)
    c.setFont(bold_font, 8)
    c.drawString(MARGIN, PAGE_H - 22, eyebrow.upper())

    # Paginador
    c.setFont(base_font, 8)
    c.setFillColor(SOFT_GRAY)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 22, f"{page_num} / {total}")


def draw_footer(c: canvas.Canvas, text: str):
    c.setFillColor(SOFT_GRAY)
    c.setFont(base_font, 7.5)
    c.drawString(MARGIN, 16, text)
    c.drawRightString(PAGE_W - MARGIN, 16, "Kublau · HSBC")


def draw_image_contained(c: canvas.Canvas, path: str, x: float, y: float, w: float, h: float):
    """Dibuja una imagen contenida en el rect (x,y,w,h) preservando aspect ratio."""
    from PIL import Image
    im = Image.open(path)
    iw, ih = im.size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx = x + (w - dw) / 2
    dy = y + (h - dh) / 2
    c.drawImage(path, dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")


def draw_flowable(c: canvas.Canvas, flowable, x, y, w, h):
    """Renderiza un Paragraph/Flowable a un rect."""
    frame = Frame(x, y, w, h, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, showBoundary=0)
    frame.addFromList([flowable], c)


# ---- Páginas -----------------------------------------------------------


def page_cover(c: canvas.Canvas, total: int):
    # Fondo blanco con franja roja izquierda
    c.setFillColor(white)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)

    # Franja roja izquierda
    c.setFillColor(HSBC_RED)
    c.rect(0, 0, 12, PAGE_H, stroke=0, fill=1)

    # Bloque de texto
    x = 80
    y = PAGE_H - 140

    c.setFillColor(HSBC_RED)
    c.setFont(bold_font, 10)
    c.drawString(x, y + 60, "FLUJO HSBC · KUBLAU")

    c.setFillColor(HSBC_DARK)
    c.setFont(bold_font, 44)
    c.drawString(x, y, "Redirección")
    c.drawString(x, y - 50, "para clientes")

    # Subtítulo
    p = Paragraph(
        "Flujo de comunicación cuando la tarjeta es redireccionada a otra sucursal o dirección.",
        ParagraphStyle("coversub", fontName=base_font, fontSize=13, leading=18,
                       textColor=TEXT_GRAY),
    )
    draw_flowable(c, p, x, y - 150, 520, 80)

    # Card lateral con metadata
    card_x = PAGE_W - 280
    card_y = 80
    card_w = 220
    card_h = PAGE_H - 200
    c.setFillColor(BG_SOFT)
    c.roundRect(card_x, card_y, card_w, card_h, 12, stroke=0, fill=1)

    c.setFillColor(HSBC_RED)
    c.setFont(bold_font, 9)
    c.drawString(card_x + 20, card_y + card_h - 30, "RESUMEN")

    items = [
        ("Pasos", "10"),
        ("Inicio", "SMS automático"),
        ("Cierre", "Email + SMS de confirmación"),
        ("Tiempo de entrega", "5–10 días hábiles"),
        ("Soporte", "55 5721 1188 opc 2"),
    ]
    yy = card_y + card_h - 60
    for k, v in items:
        c.setFillColor(SOFT_GRAY)
        c.setFont(base_font, 8)
        c.drawString(card_x + 20, yy, k.upper())
        c.setFillColor(HSBC_DARK)
        c.setFont(bold_font, 12)
        c.drawString(card_x + 20, yy - 16, v)
        yy -= 46

    # Footer cover
    c.setFillColor(SOFT_GRAY)
    c.setFont(base_font, 8)
    c.drawString(80, 40, "Centro de notificaciones · Documento interno")
    c.drawRightString(PAGE_W - MARGIN, 40, f"{total} páginas")

    c.showPage()


def page_rules(c: canvas.Canvas, page_num: int, total: int):
    draw_top_bar(c, "Reglas y restricciones", page_num, total)

    # Título
    c.setFillColor(HSBC_DARK)
    c.setFont(bold_font, 26)
    c.drawString(MARGIN, PAGE_H - 70, "Reglas del flujo")

    c.setFillColor(TEXT_GRAY)
    c.setFont(base_font, 11)
    c.drawString(MARGIN, PAGE_H - 92, "Validaciones obligatorias antes de iniciar la redirección.")

    # Tres columnas (una por categoría)
    rules = FLOW["rules"]
    col_w = (PAGE_W - 2 * MARGIN - 2 * 16) / 3
    col_h = PAGE_H - 180
    col_y = 50

    for i, rule in enumerate(rules):
        col_x = MARGIN + i * (col_w + 16)

        # Tarjeta
        c.setFillColor(white)
        c.setStrokeColor(BORDER)
        c.roundRect(col_x, col_y, col_w, col_h, 10, stroke=1, fill=1)

        # Header con acento
        c.setFillColor(ACCENT_BG)
        c.roundRect(col_x, col_y + col_h - 50, col_w, 50, 10, stroke=0, fill=1)
        # Tapar esquinas inferiores del header
        c.rect(col_x, col_y + col_h - 50, col_w, 12, stroke=0, fill=1)

        # Número grande de categoría
        c.setFillColor(HSBC_RED)
        c.setFont(bold_font, 9)
        c.drawString(col_x + 16, col_y + col_h - 22, f"CATEGORÍA {i + 1:02d}")

        cat_style = ParagraphStyle(
            "cat", fontName=bold_font, fontSize=13, leading=16,
            textColor=HSBC_DARK,
        )
        cat_p = Paragraph(rule["category"], cat_style)
        draw_flowable(c, cat_p, col_x + 16, col_y + col_h - 50, col_w - 32, 16)

        # Items
        items_html = "<br/><br/>".join(f"• {it}" for it in rule["items"])
        items_p = Paragraph(items_html, style_rule)
        draw_flowable(c, items_p, col_x + 16, col_y + 16, col_w - 32, col_h - 90)

    draw_footer(c, "Redirección · Reglas")
    c.showPage()


def page_step(c: canvas.Canvas, step: dict, page_num: int, total: int):
    draw_top_bar(c, f"Paso {step['n']:02d} · {step['title']}", page_num, total)

    # Layout: mockup izquierdo (banda gris), contenido derecho
    left_w = 280  # banda para el mockup
    left_x = MARGIN
    left_y = 50
    left_h = PAGE_H - 100

    # Banda izquierda con fondo
    c.setFillColor(BG_SOFT)
    c.roundRect(left_x, left_y, left_w, left_h, 12, stroke=0, fill=1)

    # Mockup centrado en la banda
    img_path = os.path.join(MOCKUPS_DIR, step["image"])
    if os.path.exists(img_path):
        draw_image_contained(c, img_path, left_x + 16, left_y + 16, left_w - 32, left_h - 32)
    else:
        c.setFillColor(SOFT_GRAY)
        c.setFont(base_font, 10)
        c.drawCentredString(left_x + left_w / 2, left_y + left_h / 2, "(mockup no disponible)")

    # Contenido a la derecha
    content_x = left_x + left_w + 28
    content_w = PAGE_W - content_x - MARGIN
    content_top = PAGE_H - 70

    # Píldora de paso
    pill_w = 78
    pill_h = 22
    c.setFillColor(HSBC_RED)
    c.roundRect(content_x, content_top, pill_w, pill_h, 11, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont(bold_font, 10)
    c.drawCentredString(content_x + pill_w / 2, content_top + 7, f"Paso {step['n']:02d}")

    # Título
    title_y = content_top - 14
    c.setFillColor(HSBC_DARK)
    c.setFont(bold_font, 24)
    title_p = Paragraph(step["title"], ParagraphStyle(
        "stitle", fontName=bold_font, fontSize=22, leading=26, textColor=HSBC_DARK,
    ))
    draw_flowable(c, title_p, content_x, title_y - 40, content_w, 50)

    # Descripción
    desc_p = Paragraph(step["description"], style_subtitle)
    draw_flowable(c, desc_p, content_x, title_y - 100, content_w, 60)

    # Puntos clave
    kp_section = Paragraph("Puntos clave", style_section)
    draw_flowable(c, kp_section, content_x, title_y - 130, content_w, 18)

    kp_html = "<br/>".join(f"•&nbsp;&nbsp;{p}" for p in step["key_points"])
    kp_p = Paragraph(kp_html, ParagraphStyle(
        "kp", fontName=base_font, fontSize=10.5, leading=15,
        textColor=TEXT_GRAY,
    ))
    # Altura disponible para puntos clave
    kp_top = title_y - 150
    action_h = 70
    kp_bottom = left_y + action_h + 16
    kp_h = kp_top - kp_bottom
    draw_flowable(c, kp_p, content_x, kp_bottom, content_w, kp_h)

    # Caja de acción del usuario (al pie de la columna)
    box_h = action_h
    box_y = left_y
    c.setFillColor(ACCENT_BG)
    c.setStrokeColor(HSBC_RED)
    c.setLineWidth(0.8)
    c.roundRect(content_x, box_y, content_w, box_h, 10, stroke=1, fill=1)

    c.setFillColor(HSBC_RED)
    c.setFont(bold_font, 9)
    c.drawString(content_x + 16, box_y + box_h - 20, "ACCIÓN DEL USUARIO")

    action_p = Paragraph(step["user_action"], ParagraphStyle(
        "act", fontName=bold_font, fontSize=12, leading=16, textColor=HSBC_DARK,
    ))
    draw_flowable(c, action_p, content_x + 16, box_y + 10, content_w - 32, box_h - 34)

    draw_footer(c, f"Redirección · Paso {step['n']:02d} de 10")
    c.showPage()


# ---- Main --------------------------------------------------------------


def main():
    total_pages = 2 + len(STEPS)  # portada + reglas + 10 pasos
    c = canvas.Canvas(OUTPUT, pagesize=landscape(A4))
    c.setTitle("Flujo Redirección · HSBC · Kublau")
    c.setAuthor("Kublau")
    c.setSubject("Flujo de Redirección para clientes HSBC")

    page_cover(c, total_pages)
    page_rules(c, 2, total_pages)
    for i, step in enumerate(STEPS):
        page_step(c, step, 3 + i, total_pages)

    c.save()
    print(f"Listo: {OUTPUT} ({total_pages} páginas)")


if __name__ == "__main__":
    main()
