/**
 * Gemelo React de innoboxrr-vue-datatable.
 *
 * El export por defecto es la tabla, igual que en la versión Vue. Se exponen
 * además la lógica (por si alguien quiere pintarla de otra forma), las piezas
 * con las que está hecha y el registro de rutas con nombre, que es lo que
 * React Router no trae y el contrato del modelo necesita.
 */

import DataTable from './src/DataTable.jsx'

export default DataTable

export { default as useDataTable } from './src/useDataTable.js'
export { buildPath, hasRoute, registerRoutes, resetRoutes } from './src/routes.js'
export { default as DataTableComponent } from './src/components/DataTableComponent.jsx'
export { default as SelectPaginationComponent } from './src/components/SelectPaginationComponent.jsx'
export { DEFAULT_LABELS } from './src/table.js'
