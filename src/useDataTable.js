import axios from 'axios'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Se leía de la global `csrf_token`, que la aplicación anfitriona tenía que
 * definir en window: el componente no se podía montar fuera de ella.
 */
export const csrfToken = () => globalThis.csrf_token
    ?? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
    ?? ''

/**
 * Sustituye a `_.isEqual` de lodash, que la versión Vue usaba como global sin
 * declararla como dependencia.
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

const hiddenColumnIds = (hideColumns) => hideColumns.map(
    // Se admite tanto ['name'] como [{ id: 'name' }]: el contrato nunca estuvo
    // documentado y por ahí circulan las dos formas.
    (column) => (typeof column === 'string' ? column : column?.id)
)

/**
 * Toda la lógica de la tabla: cargar, ordenar, paginar y resolver políticas.
 *
 * Está fuera del componente a propósito. Es exactamente lo mismo que hace la
 * versión Vue, y así se puede probar sin montar nada — y reutilizar si alguien
 * quiere pintar la tabla de otra forma.
 */
export default function useDataTable({
    dataUrl,
    dataMethod = 'post',
    model,
    policyUrl,
    policyMethod = 'post',
    formFilters = {},
    externalFilters = {},
    hideColumns = [],
}) {
    const head = useMemo(() => {
        const hidden = hiddenColumnIds(hideColumns)

        return model.dataTableHead().filter((column) => ! hidden.includes(column.id))
    }, [model, hideColumns])

    const [body, setBody] = useState([])
    const [pagination, setPagination] = useState({ meta: {}, links: [] })
    const [crudActions, setCrudActions] = useState(() => model.crudActions())
    const [sort, setSort] = useState(() => model.dataTableSort())
    const [orderBy, setOrderBy] = useState('id')
    const [page, setPage] = useState(1)

    const internalSort = useRef(false)
    const dataAttempts = useRef(0)
    const policyAttempts = useRef(0)
    const timers = useRef([])

    // Los props cambian de identidad en cada render del padre; las refs
    // evitan que eso reprograme la carga en bucle.
    const latest = useRef({})
    latest.current = { dataUrl, dataMethod, model, formFilters, externalFilters, orderBy, sort, page }

    const getFilters = useCallback(() => {
        const { formFilters: form, externalFilters: external, orderBy: by, sort: order, page: current } = latest.current

        const params = { _token: csrfToken(), managed: true, except_view_any: true }
        const ordering = { orderBy: by, orderMode: order[by] }

        // Con orden interno, el del usuario gana a lo que traigan los filtros
        // externos; sin él, es al revés.
        return internalSort.current
            ? { ...params, ...form, ...external, ...ordering, page: current }
            : { ...params, ...form, ...ordering, ...external, page: current }
    }, [])

    const fetchData = useCallback(async () => {
        const filters = getFilters()
        const { dataUrl: url, dataMethod: method } = latest.current

        try {
            const response = await axios({
                method,
                url,
                data: method === 'post' ? filters : null,
                params: method === 'get' ? filters : null,
            })

            dataAttempts.current = 0
            setBody(response.data.data)
            setPagination({ meta: response.data.meta, links: response.data.links })
        } catch (error) {
            // Un fallo de red no trae respuesta: leer error.response.status sin
            // comprobarlo lanzaba un TypeError dentro del propio manejador.
            if (error.response?.status === 403) {
                return
            }

            if (dataAttempts.current <= 3) {
                timers.current.push(window.setTimeout(() => {
                    dataAttempts.current += 1
                    fetchData()
                }, 1500))
            }
        }
    }, [getFilters])

    const updateFilters = useCallback(() => {
        latest.current.model.setFilters(getFilters())

        return fetchData()
    }, [fetchData, getFilters])

    const sortColumn = useCallback((column) => {
        if (column.sortable !== true) {
            return
        }

        // A partir de aquí el orden elegido por el usuario manda sobre el que
        // puedan traer los filtros externos.
        internalSort.current = true

        setOrderBy(column.id)
        setSort((current) => {
            const next = { ...current, [column.id]: current[column.id] === 'asc' ? 'desc' : 'asc' }

            latest.current.sort = next
            latest.current.orderBy = column.id

            return next
        })
    }, [])

    const updatePage = useCallback((next) => {
        latest.current.page = next
        setPage(next)
    }, [])

    const actionClicked = useCallback(async (action) => {
        try {
            await latest.current.model[action.callback](action.params)

            return updateFilters()
        } catch (error) {
            console.error(error)
        }
    }, [updateFilters])

    /**
     * Pregunta al backend qué acciones puede ejecutar el usuario sobre esa
     * fila y marca `policy` en cada una.
     */
    const actionButtonClicked = useCallback(async (actions) => {
        const requestData = { _token: csrfToken(), id: actions[0]?.params?.id ?? null }

        try {
            const response = await axios({
                method: policyMethod,
                url: policyUrl,
                data: policyMethod === 'post' ? requestData : null,
                params: policyMethod === 'get' ? requestData : null,
            })

            policyAttempts.current = 0

            const allowed = actions.map((action) => (
                response.data[action.id] ? { ...action, policy: true } : action
            ))

            // La versión Vue mutaba las acciones en sitio; en React eso no
            // repinta nada, así que se sustituye la lista.
            if (actions === crudActions) {
                setCrudActions(allowed)
            } else {
                setBody((rows) => rows.map((row) => (
                    row.actions === actions ? { ...row, actions: allowed } : row
                )))
            }

            return allowed
        } catch {
            if (policyAttempts.current <= 3) {
                timers.current.push(window.setTimeout(() => {
                    policyAttempts.current += 1
                    actionButtonClicked(actions)
                }, 1500))

                return
            }

            timers.current.push(window.setTimeout(() => {
                policyAttempts.current = 0
            }, 3000))
        }
    }, [policyMethod, policyUrl, crudActions])

    // Carga inicial y recarga cuando cambian orden o página.
    useEffect(() => {
        updateFilters()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderBy, sort, page])

    // Un filtro nuevo vuelve a la primera página; uno externo no.
    const previousForm = useRef(formFilters)
    const previousExternal = useRef(externalFilters)

    useEffect(() => {
        if (isEqual(previousForm.current, formFilters)) {
            return
        }

        previousForm.current = formFilters
        updatePage(1)
        updateFilters()
    }, [formFilters, updateFilters, updatePage])

    useEffect(() => {
        if (isEqual(previousExternal.current, externalFilters)) {
            return
        }

        previousExternal.current = externalFilters
        updateFilters()
    }, [externalFilters, updateFilters])

    useEffect(() => () => {
        timers.current.forEach((timer) => window.clearTimeout(timer))
    }, [])

    return {
        dataTable: { head, body },
        pagination,
        crudActions,
        sort,
        orderBy,
        page,
        updateFilters,
        sortColumn,
        updatePage,
        actionClicked,
        actionButtonClicked,
    }
}
