# UI/UX actual del sistema PFC

## 1) Estructura general de interfaz

El sistema usa una estructura tipo **aplicación administrativa** con layout persistente:

- **Sidebar izquierda** con navegación por módulos, colapsable y responsive.
- **Header superior** sticky con título dinámico, breadcrumb, rol/usuario y menú de cuenta.
- **Área de contenido principal** con cards, tablas, métricas y formularios.
- **Footer** institucional con año dinámico.

En ruta de login (`/login`) no se renderiza layout administrativo; se muestra pantalla de acceso dedicada.

## 2) Navegación y arquitectura visual

### Sidebar (navegación principal)

- Estética oscura institucional (`#0A1F1A`) con iconografía `lucide-react`.
- Estado activo claro (fondo resaltado y borde lateral).
- Soporta:
  - **Desktop**: expandido/colapsado.
  - **Mobile**: drawer con overlay.
- Muestra badge de cantidad de turnos futuros en el módulo `Turnos`.

### Header (contexto de pantalla)

- Título se resuelve por ruta y subruta.
- Breadcrumb visual en desktop para orientación.
- Badge del rol activo.
- Menú de usuario con acciones de perfil/configuración/logout.

### Transiciones

- Animaciones suaves de entrada en sidebar, títulos y bloques clave (`framer-motion`).

## 3) Acceso por roles y experiencia segmentada

El sistema está orientado a UX por rol, mostrando únicamente módulos permitidos:

- **admin (Marianela Farias)**:
  - `Dashboard`, `Socios PFC`, `Turnos`, `Agenda Profesional`, `Profesionales`, `Especialidades`, `Prestaciones`.
  - Ya no incluye ortopedia.
- **directivo**:
  - `Dashboard`, `Reportes`.
- **ortopedia_admin (Guadalupe Saavedra)**:
  - `Gestión de elementos`, `Asignación de elementos`, `Stock ortopedia`, `Préstamos ortopedia`.

Esto reduce ruido visual y mejora foco operativo por tipo de usuario.

## 4) Login UX actual

Pantalla centrada, visual limpia y clara:

- Card con logo institucional, selector de rol y contraseña.
- Feedback con toast para éxito/error.
- Redirección contextual:
  - `ortopedia_admin` -> `/ortopedia` (redirige internamente a `/ortopedia/gestion`).
  - demás roles con dashboard -> `/dashboard`.

## 5) Dashboard UX actual

Diseñado como panel ejecutivo-operativo con foco anual:

- Hero superior con CTA **Crear turno**.
- Grilla de métricas (`MetricCard`) con íconos, colores y textos explicativos.
- Bloque de actividad reciente.
- Gráfico de **Prestaciones más utilizadas** en formato **pie chart** (top 10).
- Tabla de **Turnos recientes** con estado en `DataBadge`.
- Interacción clave: clic en socio de turnos recientes abre historial del paciente.

Estados de experiencia:

- Loading (`Loading` component).
- Error con mensaje explícito.
- Empty state cuando no hay datos.
- Acceso restringido por permisos.

## 6) UX del módulo de Ortopedia (separado por submódulos)

La experiencia de ortopedia se dividió en páginas específicas para mejorar claridad:

### a) Gestión de elementos (`/ortopedia/gestion`)

- Alta, edición y eliminación de elementos.
- Tabla de elementos con acciones.
- Modal para creación/edición con validaciones de stock.

### b) Asignación de elementos (`/ortopedia/asignacion`)

- Búsqueda de socio/adherente con autocomplete.
- Selección de elemento disponible + observaciones.
- Registro de préstamo a 60 días.
- Dropdown con mejoras de z-index/overflow/cierre por click fuera.

### c) Stock ortopedia (`/ortopedia/stock`)

- Vista de stock consolidado (total/disponible/estado activo).
- Tabla simple para lectura rápida operativa.

### d) Préstamos ortopedia (`/ortopedia/prestamos`)

- Listado de préstamos con estado y renovaciones.
- Acciones: renovar 60 días, devolver.
- Visualización de certificado médico subido.
- Modal de renovación con carga obligatoria de imagen.

## 7) Patrones UI reutilizados

Se mantiene consistencia de componentes:

- `Card`, `Table`, `Button`, `Dialog`, `Badge`, `EmptyState`, `Loading`.
- Jerarquía visual clara: título -> descripción -> acción.
- Colores de acción consistentes (principal en verde institucional).
- Mensajería unificada con `sonner` (toast).

## 8) Responsive y usabilidad

- Sidebar mobile con overlay y cierre explícito.
- Layout fluido con grid/cards para diferentes anchos.
- Inputs y botones con alturas y focos consistentes.
- Acciones frecuentes ubicadas arriba de cada bloque.

## 9) Observaciones UX (estado actual)

- La separación de Ortopedia en submódulos mejora navegación cognitiva y reduce sobrecarga de una sola página.
- Existe una base visual sólida y consistente en casi todos los módulos.
- El sistema combina bien visualización ejecutiva (dashboard/reportes) con operación diaria (turnos/socios/ortopedia).
