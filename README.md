# Seguimiento de práctica clínica (réplica)

Réplica local e independiente de la app «Seguimiento de práctica clínica» (artefacto de Claude).  
No es la app [Seguimiento de práctica clínica / seguimiento-discentes](https://abrilha91-source.github.io/seguimiento-discentes/), que lleva otro tablero, estadísticas e inasistencias.

**Slug propuesto para el repositorio:** `practica-clinica-partes`

## Qué hace

Tablero de la Subsección de Práctica Clínica, con las mismas pestañas que el original:

- **Panorama** — resumen y cadetes en riesgo
- **Parte del día** — asistencia por sede y turno, novedades y mensaje de WhatsApp
- **Cadetes** — listado, expediente, inasistencias, retardos, anecdotario y arrestos
- **Novedades** — consultas y reporte semanal
- **Calificaciones** — instrumento, trabajo de investigación y evaluación parcial
- **Bitácoras** — carga de fotos, PDF, Excel o Word (el texto se lee en el dispositivo)
- **Ajustes** — criterios, prácticas, concentrado en Excel y respaldos

Los catálogos (materias, motivos, tipos, reposición, horas del reglamento) van incluidos. La app se publica **vacía**: no lleva cadetes ni partes. Los registros se quedan en este dispositivo (IndexedDB).

## Cómo traer el contenido

En **Ajustes**:

1. **Importar concentrado .xlsx** — el libro que descarga la app original («CONCENTRADO PRACTICA CLINICA …»).
2. **Importar respaldo JSON** — un respaldo hecho en esta réplica.
3. **Descargar concentrado .xlsx** y **Descargar respaldo JSON** para copiar o respaldar.

## Qué no se pudo replicar

El original pedía a Claude que leyera fotos y bitácoras. Esa lectura con inteligencia artificial no está disponible aquí. En su lugar, la réplica extrae el texto de PDF, Excel, Word o de lo que se pegue, y pide revisión antes de aplicar. Las fotos se guardan en el archivo de bitácoras, pero no se transcriben solas.

## Uso sin conexión

Es una PWA: tras la primera visita se puede instalar y abrir sin red. Las bibliotecas y las fuentes van en la carpeta `vendor/`.

## Privacidad

No sube datos a ningún servidor. No publiques un repositorio con el concentrado, el respaldo JSON ni capturas con nombres o matrículas.
