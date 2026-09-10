# Estudio único de Joga Motion

La página del creador pasa a un único flujo: hasta ocho imágenes de referencia, descripción y Crear video. Un solo video horizontal de cinco segundos. La imagen intermedia se crea automáticamente y se anima con la misma descripción. Se eliminan de esta pantalla el editor por escenas, montaje, estilo, intensidad y selección de formato. La portada conserva sus archivos de diseño originales.

Nuevos archivos: studio.js y studio.css, cargados por creator.html. El Worker amplía /compose a 1–8 referencias conforme al máximo documentado de Nano Banana. Todos los archivos se suben al mismo trabajo de imagen; no se generan ocho clips independientes. Los retratos, objetos y lugares se incorporan según la descripción, con fidelidad no garantizada.

Las consultas interrumpidas conservan los identificadores de imagen y video. Reanudar consulta trabajos existentes sin duplicar envíos. Si una respuesta de envío se pierde, se avisa y se pide revisar la actividad del proveedor antes de reenviar. Cambiar fotos o descripción descarta el resultado en memoria. No hay persistencia al recargar.

Validación: tests/studio.cjs (Chrome, API simulada) cubre un único campo de carga y de descripción, límite de ocho referencias, ES/EN, flujo imagen→video, reanudación, descarga, invalidación, formato móvil. tests/composer-worker.mjs cubre 0/1/2/8/9 referencias, subida y contrato, descarga por tarea y errores transitorios. tests/worker.mjs mantiene las comprobaciones de video. No se realizó una generación pagada.

Publicar: actualizar worker.js en Cloudflare para admitir ocho imágenes y hacer Push origin en GitHub Desktop. Antes de esa actualización, el Worker anterior admite como máximo dos imágenes. Es necesaria una prueba real posterior con la cuenta del usuario.
