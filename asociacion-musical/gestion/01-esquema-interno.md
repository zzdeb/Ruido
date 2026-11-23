# Esquema opcional de gestión interna

Este es un esquema operativo, no una aplicación ni una contabilidad fiscal. Se puede implementar con una hoja de cálculo o una herramienta con acceso restringido.

## Registros propuestos

### Personas asociadas

| Campo | Descripción |
|---|---|
| ID interno | Identificador estable, no reutilizado. |
| Nombre y datos de contacto necesarios | Datos mínimos para la gestión y comunicación. |
| Fecha de alta y, cuando exista, baja | Conforme a los acuerdos y comunicaciones reales. |
| Estado | Activa o baja; registrar cambios con su fecha. |

### Cuotas

| Campo | Descripción |
|---|---|
| ID de cuota y de persona asociada | Identificadores que relacionan el recibo con la persona. |
| Periodo y vencimiento | Periodo cubierto y fecha de vencimiento. |
| Importe | Cantidad aprobada, en euros. |
| Estado y fecha de cobro | Pendiente, cobrada o anulada, y fecha cuando corresponda. |
| Referencia de justificante | Identificador del comprobante sin guardar datos bancarios innecesarios. |

No asumir que un impago produce baja automática: aplicad el procedimiento estatutario y documentad cualquier acuerdo.

### Ensayos

| Campo | Descripción |
|---|---|
| ID de ensayo | Identificador estable. |
| Fecha, hora de inicio y fin | Con zona horaria y duración. |
| Lugar y estado | Previsto, confirmado o cancelado; una solicitud no es una reserva confirmada. |
| Responsable y observaciones | Solo los datos necesarios para organizarlo. |

## Rutina mínima y privacidad

1. Registrar el alta de socios y los acuerdos de cuotas.
2. Anotar cada cuota y conciliar los cobros con sus justificantes; no almacenar números de tarjeta.
3. Registrar ensayos y confirmar disponibilidad y permisos antes de anunciarlos.
4. Restringir acceso por función, mantener copias protegidas, definir plazos de conservación y atender los derechos de protección de datos. No publicar estos registros ni subir datos reales al repositorio.
5. Mantener por separado los libros, las facturas y la contabilidad exigidos por la normativa: este esquema no los sustituye.
