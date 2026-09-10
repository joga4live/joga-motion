# Editor de escenas — 10 septiembre

Implementación local, sin publicar ni hacer push.

- Hasta ocho imágenes JPEG/PNG/WebP, 10 MB por archivo; selección múltiple y arrastre.
- Orden mediante flechas, eliminación, instrucciones, duración 5/10 s, estilo e intensidad por escena.
- Cada imagen usa el contrato existente de generación individual. Estilo/intensidad son instrucciones de texto; no se inventan parámetros del modelo.
- Generación secuencial. Se conservan tareas y clips terminados durante errores de consulta; editar invalida solamente esa escena. Reordenar no genera nuevos clips.
- Exportación local de clips reales con cortes directos, sin audio, a 720p con encuadre conservado. MediaRecorder elige WebM o MP4 según soporte. Descarga individual mediante el Worker existente.
- Español/inglés, selector con nombres completos, preferencia persistente, atributo HTML lang y textos de escenas en ambos idiomas. Los prompts escritos por el usuario se conservan en su idioma original al cambiar la interfaz.
- Worker: errores transitorios de consulta retornan HTTP 502, sin declarar el trabajo fallido; valida duración y longitud del prompt.

## Límites

Mantener la página abierta: no hay persistencia del proyecto ni recuperación después de recargar. Mantener visible durante exportación. No se garantiza continuidad visual entre generaciones independientes. Una solicitud de generación cuya respuesta se pierde antes de recibir task_id no puede recuperarse con el contrato actual: el proveedor podría haberla aceptado. La UI no reintenta automáticamente esa solicitud.

Publicar eventualmente requiere actualizar tanto archivos estáticos como Worker para recibir la corrección de errores transitorios. No se probaron credenciales ni generaciones pagadas. La validación utiliza respuestas aisladas del proveedor y clips de prueba codificados en el navegador.

## Pruebas

`node tests/worker.mjs` comprueba errores transitorios, duración e identificadores inválidos.
`node tests/creator.cjs` requiere Playwright y Chrome; cubre escenas, cambio ES/EN sin pérdida de datos, orden, carga multipart, reanudación sin duplicación, exportación, invalidación y diseño móvil. Si Playwright está instalado fuera del proyecto, configurar NODE_PATH al directorio que lo contiene.

Validación final: pruebas de Worker, sintaxis y diff sin errores. Prueba integral Chrome aprobada: cambio ES/EN, controles y orden, reanudación, unión de dos clips codificados de prueba con archivo descargable, invalidación al editar y ancho móvil de 390 px. Captura móvil inspeccionada. No se ha validado Safari ni se ha realizado una generación real contra Higgsfield.
