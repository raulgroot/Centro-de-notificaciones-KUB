# Catálogo de reglas — HSBC Premier (3.0)

> **Estado:** borrador para revisión con HSBC. Todavía NO está conectado al
> módulo de creación de notificaciones. Este documento transcribe el manual
> _Manual Guidelines HSBC (Premier 3.0)_ a un formato accionable para que más
> adelante alimente el **pre-flight check**, el **preview** y el **prompt de la
> IA**.
>
> **Fuente:** `Manual Guidelines HSBC.pdf` (26 láminas, segmento Premier /
> Affluent / Emerging Affluent). La tarjeta tope del segmento es la
> _Tarjeta de Crédito HSBC Premier World Elite_ ("WE").

---

## 0. ¿Cuándo aplica el overlay Premier? (árbol de decisión)

El manual (lámina "Omisiones") define cuándo una comunicación **debe**
segmentarse a tono Premier y cuándo se puede **omitir**.

```
¿La pieza es para el segmento Premier?
├─ NO  → reglas HSBC base (no aplica este catálogo)
└─ SÍ  → ¿es de tipo regulatoria / informativa / mantenimiento / contingencia?
         ├─ NO  → SEGMENTAR (aplica todo este catálogo)
         └─ SÍ  → en principio se OMITE el overlay, EXCEPTO si:
                  • la regulatoria involucra 2 o más triggers, o
                  • la pieza aborda beneficios específicos, o
                  • incluye la Oferta de Valor Premier
                  → entonces SÍ se segmenta.
```

> **Uso en el módulo:** este árbol puede **sugerir** automáticamente si el switch
> "¿es Premier?" debe encenderse, a partir del tipo de notificación elegido en
> el brief. No es solo un sí/no manual.

---

## 1. Reglas DURAS (validables por máquina → pre-flight check)

### 1.1 Longitud de SMS

- SMS ≤ **160 caracteres** (regla base HSBC, también aplica a Premier).
- Severidad: **bloqueante**.

### 1.2 Pilares: orden y capitalización

- Orden **fijo**, siempre: `Patrimonio | Salud | Viajes | Internacional`.
- Cada pilar empieza con **mayúscula**.
- Prohibido cambiar el orden o las palabras de los pilares.
- Ejemplo marcado como incorrecto en el manual: `Internacional | Salud | Patrimonio | Viajes`.
- Severidad: **bloqueante**.

### 1.3 Listas de vocabulario por pilar (✓ permitido / ✗ vetado)

> Detector tipo "linter de copy": resalta en vivo palabras vetadas (bloqueante)
> y sugiere las recomendadas. Aplica a asunto, preheader, headlines, cuerpo y SMS.

#### Patrimonio

| ✓ Sí usar                                                                                                                                                                                | ✗ No usar                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legado, Patrimonio, Próspero, Pleno, Futuro, Herencia, Preservar, Solidez, Planificar, Maximizar, Construir, Progresar, Invertir, Trabajar, Crecer, Fortalecer, Rendimientos, Establecer | Élite, Derroche, Enriquecimiento, Ostentar, Presumir, Discriminar, Clase alta, Privilegios, Elitismo, Opulencia, Desigualdad, Consumir, Adinerado, Despilfarro, Dominación, Pobreza, Monopolio |

_Nota del manual:_ evitar palabras que denoten exclusión o que puedan derivar en
discursos de odio (clasistas).

#### Salud

| ✓ Sí usar                                                                                                                                                                     | ✗ No usar                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Bienestar, Prevención, Cuidado integral, Calidad de vida, Equilibrio, Vitalidad, Salud emocional, Salud mental, Salud física, Apoyo, Plan, Atención, Protección, Tranquilidad | Muerte, Remedios, Curandero, Capacidades diferentes, Milagro, Resultado inmediato, Cura garantizada |

_Nota del manual:_ por el contexto actual en México se prefiere "Bienestar"
para evitar confusiones.

#### Viajes

| ✓ Sí usar                                                                                                                                                                                  | ✗ No usar                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Viaje, Inolvidable, Sueños, Experiencias, Mundial, Extranjero, Asistencia, Placentero, Vacaciones, Viaje familiar, Tranquilidad, Comodidad, Soporte, Protección, Conexiones, Sin fronteras | Mochilazo/Mochilero, Selecto, Restringido, Bajo costo, Improvisado, Nómada, Austero, Clase turista |

_Nota del manual:_ por la naturaleza del público objetivo, evitar lo que pueda
interpretarse como viaje austero / "mochila al hombro".

#### Internacional

| ✓ Sí usar                                                                                                                                      | ✗ No usar                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Viaje, Movilidad, Apertura, Diversidad, Red mundial, Alcance, Cobertura, Internacional, Extranjero, Glocal, Locales, Conexiones, Sin fronteras | Gentrificar, País barato, Moneda débil, Dominio/Dominar, Conquistar, Colonia/Colonizar, Imponer, Gringos, Supremacía, Nacionalista, Indio, Sudaca, Subdesarrollado, Tercermundista, Raza |

_Nota del manual:_ la comunicación de este pilar debe centrarse en el respeto;
NO caer en narrativas de exclusión ni dar pie a temas como "paraísos fiscales".

> ⚠️ **Las listas ✗ de Internacional y Patrimonio incluyen términos
> discriminatorios.** Por eso conviene que su detección sea **bloqueante** y de
> alta prioridad: protege a HSBC de un incidente reputacional.

### 1.4 Frases de cierre (closers) — catálogo cerrado

El mailing Premier debe cerrar con una frase del catálogo aprobado:

- Genérico: **"Tu mundo es Premier cuando tu banco lo es."**
- Por pilar (cuando un pilar es relevante), p. ej.:
  - **"Tu mundo es Premier cuando cimentas su futuro."** (Patrimonio)
  - **"Tu mundo es Premier cuando tus viajes son de otro planeta."** (Viajes)
- **Prohibido** cambiar, reestructurar o reinterpretar el concepto
  "Tu mundo es Premier".
- Severidad: **bloqueante** si se altera el concepto; **advertencia** si falta cierre.

### 1.5 Nombre de producto

- Nombre exacto: **"Tarjeta de Crédito HSBC Premier World Elite"**.
- Validar contra abreviaciones/variantes mal escritas.
- Severidad: **advertencia**.

### 1.6 Color / acento de marca

- Premier usa **Red 3** — Pantone 3523C, **HEX `#730014`**, C0 M97 Y65 K67.
- (El rojo HSBC base es `#DB0011`; **no** es el de Premier.)
- Red 3 no debe ocupar más del **30%** del total visual de la pieza.
- Logo: versión **negra** sobre fondos claros/blancos; versión **blanca** sobre
  fondos oscuros o de alto contraste. No modificar colores, efectos ni
  transparencias del logotipo.
- Subpilares bajo el logo Premier: `Patrimonio | Salud | Viajes | Internacional`.
- Severidad: **advertencia** (es más de preview/diseño que de copy).

> **Uso en el preview:** al encender el toggle "Premier", el acento del preview
> cambia a `#730014` y el lockup del logo a la variante Premier.

---

## 2. Reglas SUAVES (no binarias → prompt de la IA + checklist humano)

Estas no se validan con verde/rojo. Sirven para (a) que el copy **nazca** en
tono Premier inyectándolas al prompt, y (b) un checklist de revisión humana.

### 2.1 Tono

- Sobrio, aspiracional, centrado en la propuesta de valor Premier.
- Sin sensacionalismo, sin urgencia artificial, sin "da clic aquí".
- Headlines inherentes a la propuesta (no genéricos "sin alma").

### 2.2 Ejemplos de copy INCORRECTO (del manual — usar como few-shot negativos)

- ✗ "Tu mundo es HSBC Premier cuando abres una cuenta nueva"
- ✗ "Tu mundo es Premier cuando abres una cuenta N4."
- ✗ "Tu mundo es Premier cuando solicitas una TDC Zero."
- ✗ "Tu mundo es Premier cuando abres una cuenta digital con límite de depósitos."
- ✗ "Tu hipoteca FOVISSSTE es HSBC Premier porque abres la puerta a un descuento."

Razón: no se vale vincular el concepto Premier a productos masivos / fuera de la
oferta Premier, ni reinterpretar "Tu mundo es Premier".

### 2.3 Imágenes

- Estilo de vida premium: momentos auténticos, emotivos, entorno visual premium.
- Integrar Red 3 de forma natural en la imagen (sombras/tonos), sin sobrepasar el 30%.

---

## 3. Mapa de severidad (resumen)

| Regla                                        | Tipo          | Severidad sugerida              |
| -------------------------------------------- | ------------- | ------------------------------- |
| SMS ≤ 160                                    | dura          | bloqueante                      |
| Orden/capitalización de pilares              | dura          | bloqueante                      |
| Palabra vetada (discriminatoria)             | dura          | **bloqueante (alta prioridad)** |
| Palabra vetada (resto)                       | dura          | bloqueante                      |
| Falta palabra recomendada                    | dura          | sugerencia                      |
| Cierre altera concepto "Tu mundo es Premier" | dura          | bloqueante                      |
| Falta frase de cierre                        | dura          | advertencia                     |
| Nombre de producto mal escrito               | dura          | advertencia                     |
| Color Red 3 / uso de logo                    | dura (diseño) | advertencia                     |
| Tono / sensacionalismo / urgencia            | suave         | checklist humano + prompt IA    |

---

## 4. Pendientes / decisiones para HSBC

1. Confirmar que las listas de palabras están **completas** (transcritas de un
   PDF de imagen; conviene validar ortografía y posibles palabras cortadas).
2. ¿Las palabras vetadas se buscan exactas o también variantes/flexiones
   (plurales, género, acentos)? Recomendado: normalizar y buscar por raíz.
3. ¿El catálogo de **cierres** por pilar es cerrado y completo, o HSBC puede
   aprobar nuevos?
4. Definir dónde vive este catálogo de forma editable (no en código) para que
   marketing/HSBC lo actualice sin depender de un deploy.
