# Fotos de referencia + descripción → escena → video

Se agrega un estudio encima del editor existente. Admite una o dos fotos de referencia (JPEG, PNG o WebP; 10 MB cada una), descripción y formato horizontal, vertical o cuadrado. La imagen generada se revisa antes de añadirla como una escena al editor. El mensaje se conserva para la animación. No se inicia automáticamente una generación de video al aprobar la imagen.

## Servicio

El Worker agrega POST /compose, GET /compose-status y GET /compose-image. Usa el modelo /nano-banana con input_images [{type: "image_url", image_url: ...}], num_images: 1 y output_format: jpeg. Contrato consultado en https://docs.higgsfield.ai/docs/openapi.json el 10 de septiembre de 2026. Se reutilizan los secretos existentes HF_API_KEY_ID y HF_API_KEY_SECRET y la subida mediante URL firmada.

La imagen se recupera por identificador de tarea; el cliente no puede enviar una URL de descarga arbitraria. Los fallos temporales de consulta conservan el identificador para reanudar sin volver a generar. Si se pierde la respuesta inicial no existe recuperación automática: se advierte revisar la actividad del proveedor antes de volver a enviar.

## Publicación

1. Actualizar worker.js en Cloudflare, en joga-motion-api, y pulsar Deploy. Conservar los secretos.
2. Publicar los archivos de la web mediante Push origin en GitHub Desktop.
3. Probar con fotos propias: crear imagen, revisar rostros y acción, usar escena, elegir duración y generar video.

El parecido de las personas y el cumplimiento de acciones no están garantizados. El proyecto permanece en memoria y se pierde al recargar. Cada imagen y cada video consume una generación del proveedor. No hay precios ni cobros de usuarios implementados en esta función.

## Validación

Pruebas locales de Worker con contratos simulados: una y dos referencias, validaciones, resultado de imagen, error temporal, descarga por identificador. Pruebas Chrome con proveedor simulado: formulario bilingüe, una foto habilita generación, dos referencias, reanudación sin duplicación, revisión, transferencia del mensaje al editor, ausencia de generación automática de video, formato móvil. Pruebas anteriores del editor y exportación con clips locales pasan.

No se ha realizado una generación pagada ni confirmado acceso del plan de la cuenta al modelo de imágenes. No confundir integración preparada y pruebas simuladas con validación real en producción.
