-- Seed: "Redirección" flow.
-- Content extracted from the legacy notificaciones-hsbc app.js FLOW_DEFINITIONS.
-- Safe to re-run thanks to ON CONFLICT DO NOTHING.

INSERT INTO flows (slug, name, subtitle, accent_color, rules, sort_order, active)
VALUES (
  'redireccion',
  'Redirección para clientes',
  'Flujo de comunicación cuando la tarjeta es redireccionada a otra sucursal o dirección.',
  '#DB0011',
  '[
    {
      "category": "Restricciones por tipo de tarjeta",
      "items": [
        "No aplica para tarjetas de <strong>Débito</strong>",
        "No aplica para tarjetas <strong>TITANIUM</strong>",
        "No aplica para <strong>Altas Nuevas</strong> ni <strong>Adicionales</strong>"
      ]
    },
    {
      "category": "Restricciones geográficas",
      "items": [
        "Solo se permite redirección <strong>dentro del mismo estado</strong>",
        "<strong>Excepción:</strong> entre CDMX y Estado de México se permite redirección en ambas direcciones (Área Metropolitana)",
        "<strong>Restricción especial:</strong> bloqueada hacia/desde <strong>Puebla</strong> por fraude"
      ]
    },
    {
      "category": "Requisitos de contacto",
      "items": [
        "El TH debe tener <strong>ambos medios de contacto</strong> registrados (email y teléfono)",
        "Si inicia el flujo por SMS, debe recibir OTP por email y viceversa"
      ]
    }
  ]'::jsonb,
  1,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Steps for redirección (uses the flow's id via subquery)
WITH f AS (SELECT id FROM flows WHERE slug = 'redireccion')
INSERT INTO flow_steps (flow_id, position, title, description, key_points, user_action, mockup_image_url)
SELECT f.id, position, title, description, key_points::jsonb, user_action, mockup_image_url
FROM f, (VALUES
  (1,
   'SMS de notificación',
   'El cliente recibe un SMS informando que su tarjeta ha sido enviada con un enlace para rastrearla.',
   '["El cliente recibe un SMS automático","Incluye enlace de rastreo a Kublau","Se envía al detectar que la tarjeta fue generada"]',
   'El cliente da clic en el enlace del SMS',
   '/flows/redireccion/01-sms-notificacion.png'),

  (2,
   'Email de tránsito',
   'Se envía un correo electrónico informando que la tarjeta ha sido generada con la dirección de entrega.',
   '["Email real enviado al cliente","Incluye código de rastreo y dirección registrada","Botón para actualizar domicilio de entrega","Contacto de soporte: 55 5721 1168"]',
   'El cliente da clic en "Actualizar mi domicilio de entrega"',
   '/flows/redireccion/02-email-transito.png'),

  (3,
   'Advertencia de seguridad',
   'Al ingresar al enlace, se muestra una advertencia informando que el sitio no solicitará datos privados.',
   '["Advertencia de privacidad obligatoria","Informa que nunca se piden datos sensibles","Servicio operado por tercero a solicitud de HSBC"]',
   'El cliente da clic en "Continuar"',
   '/flows/redireccion/03-advertencia.png'),

  (4,
   'Verificar dirección actual',
   'El cliente verifica la dirección de entrega actual y puede optar por cambiarla.',
   '["Se muestra la dirección actual de entrega","Aviso de restricción: solo mismo estado o zona metropolitana","Si necesita otro estado, debe llamar al 55 5721 1188 opc 2"]',
   'El cliente da clic en "Quiero cambiar mi dirección de entrega"',
   '/flows/redireccion/04-verificar-direccion.png'),

  (5,
   'Verificación de seguridad',
   'Se envía un código de verificación al correo electrónico registrado del cliente.',
   '["Envío de OTP al correo registrado","El código puede demorar hasta 1 minuto","Solo se puede generar el código 2 veces","Si no tiene acceso al correo, debe llamar o ir a sucursal"]',
   'El cliente da clic en "Enviar código"',
   '/flows/redireccion/05-verificacion-seguridad.png'),

  (6,
   'Ingresar código',
   'El cliente ingresa el código de verificación recibido por SMS o email.',
   '["Campo de 6 dígitos para el OTP","Si inició por SMS, el OTP llega por email y viceversa","Validación en tiempo real del código","Timer de reenvío y aviso para revisar spam"]',
   'El cliente ingresa el código de 6 dígitos y confirma',
   '/flows/redireccion/06-ingresar-codigo.png'),

  (7,
   'Ingresar nueva dirección',
   'El cliente llena un formulario con la nueva dirección de entrega para su tarjeta.',
   '["Formulario completo de nueva dirección","Validación automática de código postal","Campos: calle, número ext/int, CP, colonia, ciudad, estado","Campo de indicaciones y referencias"]',
   'El cliente llena el formulario y da clic en "Guardar mi dirección"',
   '/flows/redireccion/07-ingresar-direccion.png'),

  (8,
   'Confirmar dirección',
   'El cliente revisa y confirma la nueva dirección de entrega antes de proceder.',
   '["Resumen de la nueva dirección ingresada","Última oportunidad de corregir antes de confirmar","Si no es correcta, puede regresar a modificar"]',
   'El cliente da clic en "Confirmar"',
   '/flows/redireccion/08-confirmar-direccion.png'),

  (9,
   'Redirección exitosa',
   'Se confirma que la solicitud de redirección fue procesada exitosamente con un número de folio.',
   '["Se genera un folio de seguimiento","También se envía confirmación por email","Tiempo de entrega: 5 a 10 días hábiles","Contacto de soporte: 55 5721 1188 opc 2"]',
   'Fin del flujo web. El cliente puede cerrar la página.',
   '/flows/redireccion/09-redireccion-exitosa.png'),

  (10,
   'Confirmación por email y SMS',
   'El cliente recibe confirmación final por correo electrónico y SMS con el folio de su solicitud.',
   '["Email de confirmación con folio y nueva dirección","SMS de confirmación enviado simultáneamente","Incluye datos de contacto para dudas","Footer con info legal de HSBC y Kublau"]',
   'El cliente recibe la confirmación. No requiere acción adicional.',
   '/flows/redireccion/10-email-confirmacion.png')
) AS s(position, title, description, key_points, user_action, mockup_image_url);
