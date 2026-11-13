# Seguimiento de práctica clínica (réplica)

Réplica local e independiente de la app «Seguimiento de práctica clínica» (artefacto de Claude).  
No es la app [Seguimiento de práctica clínica / seguimiento-discentes](https://abrilha91-source.github.io/seguimiento-discentes/), que lleva otro tablero, estadísticas e inasistencias.

**Repositorio:** [abrilha91-source/practica-clinica-partes](https://github.com/abrilha91-source/practica-clinica-partes)  
**Página:** https://abrilha91-source.github.io/practica-clinica-partes/  
**Versión:** 1.1

## Qué hace

Tablero de la Subsección de Práctica Clínica:

- **Panorama** — resumen y cadetes en riesgo
- **Parte del día** — asistencia por sede y turno, novedades y mensaje de WhatsApp
- **Cadetes** — listado, expediente, inasistencias, retardos, anecdotario y arrestos
- **Novedades** — consultas y reporte semanal
- **Calificaciones** — instrumento, trabajo de investigación y evaluación parcial
- **Estadísticas** — consulta general o filtrada (cadete, grupo, año, práctica, sede, turno, motivo, tipo, fechas, mes o semana); totales, desgloses, porcentajes, rankings y cercanía al 30 %. Se puede descargar un Excel con hojas de resumen, desglose y detalle.
- **Bitácoras** — carga de PDF, Excel, Word, PowerPoint, fotos (JPG, PNG) y audio (MP3, WAV), o texto pegado. Varios archivos a la vez o arrastrándolos. El texto se lee en este dispositivo y se revisa antes de aplicar.
- **Ajustes** — criterios, prácticas, concentrado en Excel y respaldos

Los catálogos (materias, motivos, tipos, reposición, horas del reglamento) van incluidos. La app se publica **vacía**: no lleva cadetes ni partes. Los registros se quedan en este dispositivo (IndexedDB).

## Lectura de archivos (en el dispositivo)

No se envía nada a un servicio en la nube. Precisión aproximada:

| Formato | Qué se lee | Precisión |
| --- | --- | --- |
| Excel / CSV | Celdas con SheetJS | Alta, si el libro no está dañado |
| Word (.docx) | Texto del XML | Alta en documentos normales; no se leen .doc antiguos |
| PowerPoint (.pptx) | Texto de las diapositivas | Alta en texto de diapositiva; no se leen .ppt antiguos ni imágenes incrustadas |
| PDF de texto | Texto con pdf.js | Alta si el PDF tiene capa de texto |
| PDF escaneado o foto (JPG, PNG) | OCR con Tesseract (español e inglés), la primera vez descarga los modelos y los deja en caché | Media: buena con letra impresa nítida; baja con letra a mano, sesgo o poca luz. Conviene revisar |
| MP3 / WAV | Se intenta transcribir en el navegador (Whisper tiny, español), con barra de progreso; si no es viable (memoria, falta de aislamiento del documento o archivo muy largo), el audio se guarda adjunto | Variable y a menudo baja con el modelo pequeño; no sustituye una transcripción revisada |

## Cómo traer el contenido

En **Ajustes**:

1. **Importar concentrado .xlsx** — el libro que descarga la app original («CONCENTRADO PRACTICA CLINICA …»).
2. **Importar respaldo JSON** — un respaldo hecho en esta réplica.
3. **Descargar concentrado .xlsx** y **Descargar respaldo JSON** para copiar o respaldar.

## Uso sin conexión

Es una PWA: tras la primera visita se puede instalar y abrir sin red. Las bibliotecas y las fuentes van en la carpeta `vendor/`. Los modelos de OCR y, si se usa, de transcripción se descargan la primera vez y quedan en la caché del navegador.

## Privacidad

No sube datos a ningún servidor. No publiques un repositorio con el concentrado, el respaldo JSON ni capturas con nombres o matrículas.
