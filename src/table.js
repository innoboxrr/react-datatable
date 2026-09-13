/**
 * Lo que la tabla decide sin depender de Vue ni de React: cómo se traduce el
 * contrato del modelo a columnas de TanStack Table, qué se pide al servidor,
 * qué se le dice al usuario cuando algo falla y en qué se convierte cada
 * acción.
 *
 * El archivo es idéntico en innoboxrr-vue-datatable y en
 * innoboxrr-react-datatable. Es lo que hace que las dos tablas se comporten
 * igual: si cambia aquí, cambia allí.
 */

/** Las acciones que borran se pintan en rojo aunque el modelo no lo diga. */
const DANGER_ACTIONS = ['delete', 'forceDelete']

/** La clave con la que se guardan los permisos de la barra superior. */
export const CRUD_POLICIES = '__crud__'

export const DEFAULT_LABELS = {
    actions: 'Acciones',
    rowActions: 'Acciones del registro',
    refresh: 'Actualizar',
    filters: 'Filtros',
    selectAll: 'Seleccionar todos los de esta página',
    selectRow: 'Seleccionar el registro',
    selection: 'Selección',
    selected: 'seleccionados',
    clearSelection: 'Quitar selección',
    empty: 'No hay resultados',
    retry: 'Reintentar',
    of: 'de',
    page: 'Página',
    previous: 'Página anterior',
    next: 'Página siguiente',
    forbidden: 'No tienes permiso para ver estos registros.',
    offline: 'No se pudo conectar con el servidor.',
    failed: 'No se pudieron cargar los registros.',
    policiesFailed: 'No se pudieron comprobar los permisos.',
    notAllowed: 'No tienes permiso para esta acción.',
    actionFailed: 'No se pudo completar la acción.',
}

/**
 * Se leía de la global `csrf_token`, que la aplicación anfitriona tenía que
 * definir en window: el componente no se podía montar fuera de ella.
 */
export const csrfToken = () => globalThis.csrf_token
    ?? globalThis.document?.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
    ?? ''

/**
 * Sustituye a `_.isEqual` de lodash, que se usaba como global sin declararla
 * como dependencia.
 */
export const isEqual = (a, b) => {
    if (a === b) {
        return true
    }

    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
        return false
    }

    const keysA = Object.keys(a)
    const keysB = Object.keys(b)

    return keysA.length === keysB.length && keysA.every((key) => isEqual(a[key], b[key]))
}

/**
 * Una foto de un objeto de filtros. Comparar contra el valor anterior no sirve
 * cuando el anfitrión muta el mismo objeto: el anterior y el nuevo son el mismo.
 */
export const snapshot = (value) => JSON.stringify(value ?? {})

/**
 * Se admite tanto ['name'] como [{ id: 'name' }]: el contrato nunca estuvo
 * documentado y por ahí circulan las dos formas.
 */
export const hiddenColumnIds = (hideColumns = []) => hideColumns
    .map((column) => (typeof column === 'string' ? column : column?.id))
    .filter(Boolean)

/**
 * `dataTableHead()` del modelo, en columnas de TanStack Table. La columna
 * original viaja en `meta.head`, que es de donde la tabla saca el parser, el
 * componente y si el valor es HTML.
 */
export const columnsFrom = (head = []) => head.map((column) => ({
    id: column.id,
    accessorFn: (row) => row?.[column.id],
    header: column.value,
    enableSorting: column.sortable === true,
    meta: { head: column },
}))

/** Solo un `false` explícito oculta una columna en TanStack Table. */
export const visibilityFrom = (hideColumns) => Object.fromEntries(
    hiddenColumnIds(hideColumns).map((id) => [id, false])
)

/** El orden lo decide el servidor; la tabla solo lo refleja. */
export const sortingFrom = (orderBy, sort = {}) => (
    orderBy ? [{ id: orderBy, desc: sort[orderBy] === 'desc' }] : []
)

/**
 * La primera pulsación sobre una columna que el modelo no ordena por defecto
 * la deja ascendente; las siguientes alternan.
 */
export const toggledSort = (sort, id) => ({ ...sort, [id]: sort[id] === 'asc' ? 'desc' : 'asc' })

export const ariaSort = (column, orderBy, sort = {}) => {
    if (column.sortable !== true) {
        return undefined
    }

    if (column.id !== orderBy) {
        return 'none'
    }

    return sort[column.id] === 'desc' ? 'descending' : 'ascending'
}

export const sortIcon = (column, orderBy, sort = {}) => {
    const state = ariaSort(column, orderBy, sort)

    return state === 'ascending' ? 'sortUp' : state === 'descending' ? 'sortDown' : 'sort'
}

/**
 * Lo que espera el backend. Con orden interno, el del usuario gana a lo que
 * traigan los filtros externos; sin él, es al revés.
 */
export const requestFilters = ({ formFilters = {}, externalFilters = {}, orderBy, sort = {}, page, internalSort }) => {
    const params = { _token: csrfToken(), managed: true, except_view_any: true }
    const order = { orderBy, orderMode: sort[orderBy] }

    return internalSort
        ? { ...params, ...formFilters, ...externalFilters, ...order, page }
        : { ...params, ...formFilters, ...order, ...externalFilters, page }
}

export const requestConfig = (method, url, payload) => ({
    method,
    url,
    data: method === 'post' ? payload : null,
    params: method === 'get' ? payload : null,
})

/** El usuario canceló una confirmación: no es un error que haya que contar. */
export const isCancelled = (error) => ['RequestCancelledError', 'CanceledError'].includes(error?.name)

/**
 * Qué decirle al usuario. Antes un fallo se reintentaba tres veces en silencio
 * y un 403 dejaba la tabla vacía con «No results found», como si no hubiera
 * registros.
 */
export const describeError = (error, labels = DEFAULT_LABELS, fallback = labels.failed) => {
    const status = error?.response?.status ?? null

    if (status === 403) {
        return { status, message: labels.forbidden, retryable: false }
    }

    // Un fallo de red no trae respuesta; un error de programa, tampoco, y no
    // es cosa de la conexión.
    if (! error?.response) {
        const offline = Boolean(error?.request) || error?.code === 'ERR_NETWORK' || error?.message === 'Network Error'

        return { status, message: offline ? labels.offline : fallback, retryable: true }
    }

    const message = error.response.data?.message

    return {
        status,
        message: typeof message === 'string' && message !== '' ? message : fallback,
        retryable: true,
    }
}

/**
 * Marca `policy` en cada acción según lo que respondió el backend. Una acción
 * que el modelo declara ya permitida se queda así.
 */
export const withPolicies = (actions = [], allowed = null) => actions.map((action) => ({
    ...action,
    policy: action.policy === true || allowed?.[action.id] === true,
}))

export const actionKind = (action) => {
    if (! action.route) {
        return 'callback'
    }

    return action.link ? 'link' : 'route'
}

export const routeTarget = (action, extraParams = {}, extraQuery = {}) => {
    const to = action.params?.to ?? {}

    return {
        name: to.name,
        params: { ...(to.params ?? {}), ...extraParams },
        query: to.query ? { ...to.query, ...extraQuery } : { ...extraQuery },
    }
}

/**
 * Las acciones del contrato, como elementos de MenuComponent. Una acción sin
 * permiso se ve deshabilitada y dice por qué: quien no puede tiene que saber
 * que existe.
 */
export const menuItems = (actions = [], labels, run) => actions.map((action, index) => {
    const allowed = action.policy === true

    return {
        id: action.id ?? `${action.name}-${index}`,
        label: action.name,
        icon: action.icon || undefined,
        danger: action.danger ?? DANGER_ACTIONS.includes(action.id),
        disabled: ! allowed,
        disabledReason: allowed ? undefined : labels.notAllowed,
        action: () => run(action),
    }
})

/**
 * Copia aislada de una fila, para que un parser del modelo no pueda mutar los
 * datos de la tabla. Se hace una vez por fila y carga, no una por celda.
 */
export const cloneRow = (row) => JSON.parse(JSON.stringify(row ?? {}))

export const cellValue = (column, row) => (
    typeof column.parser === 'function' ? column.parser(row?.[column.id], row) : row?.[column.id]
)

/** Un componente de celda recibe el objeto que devuelve el parser, o `{ value }`. */
export const componentProps = (value) => (
    typeof value === 'object' && value !== null && ! Array.isArray(value) ? value : { value }
)

export const summary = (meta = {}, labels = DEFAULT_LABELS) => (
    meta.total > 0 ? `${meta.from}–${meta.to} ${labels.of} ${meta.total}` : labels.empty
)

/**
 * La casilla de un rango con Mayúsculas. El evento de cambio de una casilla
 * no siempre trae la tecla; el clic, sí.
 */
export const isRangeEvent = (event) => Boolean(event?.shiftKey ?? event?.nativeEvent?.shiftKey)
