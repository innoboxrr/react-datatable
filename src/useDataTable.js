import axios from 'axios'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
    columnVisibilityFeature,
    rowSelectionFeature,
    rowSortingFeature,
    tableFeatures,
    useTable,
} from '@tanstack/react-table'
import { notifyError, notifySuccess } from 'innoboxrr-form-core'

import * as core from './table.js'

/**
 * Solo lo que la tabla usa. El orden y la paginación los hace el servidor, así
 * que no hay modelos de filas ordenadas ni paginadas: TanStack Table lleva el
 * estado —qué columnas se ven, qué filas están seleccionadas, por qué columna
 * se ordena— y la tabla pinta.
 */
const features = tableFeatures({ rowSortingFeature, columnVisibilityFeature, rowSelectionFeature })

// Un array nuevo en cada render invalidaría los modelos de TanStack Table.
const NO_ROWS = []
const NO_SELECTION = {}

/**
 * Toda la lógica de la tabla: cargar, ordenar, paginar, seleccionar y resolver
 * permisos. Es la misma que `useDataTable` de innoboxrr-vue-datatable.
 *
 * Está fuera del componente para poder probarla y para pintar la misma tabla
 * de otra forma.
 */
export default function useDataTable({
    dataUrl,
    dataMethod = 'post',
    model,
    policyUrl,
    policyMethod = 'post',
    formFilters = {},
    externalFilters = {},
    extraParams = {},
    extraQuery = {},
    hideColumns = [],
    selectable = false,
    labels = core.DEFAULT_LABELS,
    navigate = null,
}) {
    const head = useMemo(() => model.dataTableHead(), [model])
    const columns = useMemo(() => core.columnsFrom(head), [head])

    // Los props llegan como objetos nuevos en cada render del padre: se
    // compara su contenido, no su identidad.
    const hiddenKey = core.snapshot(core.hiddenColumnIds(hideColumns))
    const formKey = core.snapshot(formFilters)
    const externalKey = core.snapshot(externalFilters)

    const visibleHead = useMemo(() => {
        const hidden = JSON.parse(hiddenKey)

        return head.filter((column) => ! hidden.includes(column.id))
    }, [head, hiddenKey])

    const columnVisibility = useMemo(() => core.visibilityFrom(JSON.parse(hiddenKey)), [hiddenKey])

    const [rows, setRows] = useState(NO_ROWS)
    const [meta, setMeta] = useState({})
    const [links, setLinks] = useState(NO_ROWS)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [sort, setSort] = useState(() => ({ ...model.dataTableSort() }))
    const [orderBy, setOrderBy] = useState('id')
    const [page, setPage] = useState(1)

    /** Lo que respondió el backend de permisos, por fila y para la barra. */
    const [allowed, setAllowed] = useState({})

    const sorting = useMemo(() => core.sortingFrom(orderBy, sort), [orderBy, sort])

    const table = useTable({
        features,
        columns,
        data: rows,
        getRowId: (row, index) => String(row?.id ?? index),
        manualSorting: true,
        enableRowSelection: selectable === true,
        isRowRangeSelectionEvent: core.isRangeEvent,
        state: { columnVisibility, sorting },
    })

    const rowSelection = table.state.rowSelection ?? NO_SELECTION
    const selectedIds = useMemo(() => Object.keys(rowSelection).filter((id) => rowSelection[id]), [rowSelection])

    /**
     * Una copia por fila y carga, para que un parser del modelo no pueda mutar
     * los datos de la tabla.
     */
    const clones = useMemo(() => rows.map(core.cloneRow), [rows])

    const crudActions = useMemo(
        () => core.withPolicies(model.crudActions(), allowed[core.CRUD_POLICIES]),
        [model, allowed]
    )

    const bulkActions = useMemo(
        () => (typeof model.bulkActions === 'function' ? model.bulkActions() : NO_ROWS),
        [model]
    )

    const rowActions = useCallback(
        (row) => core.withPolicies(row?.actions ?? NO_ROWS, allowed[String(row?.id)]),
        [allowed]
    )

    // Lo que las funciones asíncronas leen cuando terminan: el valor de ese
    // momento, no el del render en que empezaron.
    const latest = useRef({})

    latest.current = {
        dataUrl, dataMethod, model, policyUrl, policyMethod, formFilters, externalFilters,
        extraParams, extraQuery, labels, navigate, orderBy, sort, page, rows, allowed, table,
    }

    const internalSort = useRef(false)
    const requestId = useRef(0)
    const mounted = useRef(false)

    useEffect(() => {
        mounted.current = true

        return () => {
            mounted.current = false
        }
    }, [])

    const load = useCallback(async () => {
        const id = ++requestId.current
        const current = latest.current

        const filters = core.requestFilters({
            formFilters: current.formFilters,
            externalFilters: current.externalFilters,
            orderBy: current.orderBy,
            sort: current.sort,
            page: current.page,
            internalSort: internalSort.current,
        })

        current.model.setFilters?.(filters)
        setLoading(true)

        // Una respuesta que llega tarde no pisa a la de una petición posterior.
        const stale = () => id !== requestId.current || ! mounted.current

        try {
            const response = await axios(core.requestConfig(current.dataMethod, current.dataUrl, filters))

            if (stale()) {
                return
            }

            setRows(response.data?.data ?? NO_ROWS)
            setMeta(response.data?.meta ?? {})
            setLinks(response.data?.links ?? NO_ROWS)
            setError(null)

            // Con datos nuevos los permisos se vuelven a preguntar.
            setAllowed({})
        } catch (failure) {
            if (stale()) {
                return
            }

            const described = core.describeError(failure, latest.current.labels)

            if (described.status === 403) {
                setRows(NO_ROWS)
                setMeta({})
            } else if (latest.current.rows.length > 0) {
                // Con filas en pantalla el error no tiene sitio en la tabla:
                // se avisa y se deja lo que había.
                notifyError(described.message)
            }

            setError(described)
        } finally {
            if (! stale()) {
                setLoading(false)
            }
        }
    }, [])

    const clearSelection = useCallback(() => {
        latest.current.table.resetRowSelection(true)
    }, [])

    /**
     * Una sola petición por cambio. Un filtro nuevo en otra página primero
     * vuelve a la 1 y carga en la pasada siguiente; antes eran dos peticiones
     * iguales, porque la página y los filtros se vigilaban por separado.
     */
    const seen = useRef({ formKey, externalKey })
    const sortKey = core.snapshot(sort)

    useEffect(() => {
        const previous = seen.current

        seen.current = { formKey, externalKey }

        // Un filtro nuevo o externo descarta la selección, que era de otro
        // listado; solo el del formulario vuelve a la primera página.
        if (previous.formKey !== formKey || previous.externalKey !== externalKey) {
            clearSelection()
        }

        if (previous.formKey !== formKey && page !== 1) {
            setPage(1)

            return
        }

        load()
    }, [formKey, externalKey, orderBy, sortKey, page, load, clearSelection])

    const refresh = useCallback(() => load(), [load])

    const sortColumn = useCallback((column) => {
        if (column?.sortable !== true) {
            return
        }

        internalSort.current = true

        setSort((current) => core.toggledSort(current, column.id))
        setOrderBy(column.id)
    }, [])

    const updatePage = useCallback((next) => {
        const value = Number(next)

        if (Number.isInteger(value) && value >= 1) {
            setPage(value)
        }
    }, [])

    /**
     * Pregunta al backend qué se puede hacer con una fila —o con la barra, sin
     * id— antes de abrir su menú. Lo que responde se guarda hasta la próxima
     * carga.
     */
    const preparePolicies = useCallback(async (id = null) => {
        const key = id == null ? core.CRUD_POLICIES : String(id)
        const current = latest.current

        if (current.allowed[key]) {
            return
        }

        try {
            const response = await axios(core.requestConfig(current.policyMethod, current.policyUrl, {
                _token: core.csrfToken(),
                id,
            }))

            if (! mounted.current) {
                return
            }

            // Se pinta ya: el menú se abre justo después, y tiene que abrir con
            // los permisos puestos y no enseñarlos cambiando.
            flushSync(() => {
                setAllowed((previous) => ({ ...previous, [key]: response.data ?? {} }))
            })
        } catch {
            // El menú se abre igual, con todo deshabilitado.
            notifyError(latest.current.labels.policiesFailed)
        }
    }, [])

    const run = useCallback(async (action) => {
        const current = latest.current
        const text = current.labels
        const kind = core.actionKind(action)

        if (kind === 'route') {
            if (! current.navigate) {
                notifyError(text.actionFailed)

                return undefined
            }

            try {
                await current.navigate(core.routeTarget(action, current.extraParams, current.extraQuery))
            } catch (failure) {
                // Una ruta que no existe es un error de quien declaró la
                // acción: el usuario recibe un aviso y la consola, el detalle.
                notifyError(text.actionFailed)
                console.error(failure)
            }

            return undefined
        }

        if (kind === 'link') {
            globalThis.window?.open(action.params?.link, action.params?.target ?? '_self')

            return undefined
        }

        if (typeof current.model[action.callback] !== 'function') {
            notifyError(text.actionFailed)

            return undefined
        }

        try {
            await current.model[action.callback](action.params)
        } catch (failure) {
            if (! core.isCancelled(failure)) {
                notifyError(core.describeError(failure, text, text.actionFailed).message)
            }

            return undefined
        }

        if (action.success) {
            notifySuccess(action.success)
        }

        return load()
    }, [load])

    /**
     * Una acción masiva recibe los ids seleccionados —también los de otras
     * páginas— y las filas cargadas que están entre ellos.
     */
    const runBulk = useCallback(async (action) => {
        const current = latest.current
        const text = current.labels

        if (typeof current.model[action.callback] !== 'function') {
            notifyError(text.actionFailed)

            return undefined
        }

        const selected = current.table.state.rowSelection ?? NO_SELECTION
        const ids = Object.keys(selected).filter((id) => selected[id])
        const loaded = current.table.getSelectedRowModel().rows.map((row) => row.original)

        try {
            await current.model[action.callback](ids, loaded)
        } catch (failure) {
            if (! core.isCancelled(failure)) {
                notifyError(core.describeError(failure, text, text.actionFailed).message)
            }

            return undefined
        }

        clearSelection()

        if (action.success) {
            notifySuccess(action.success)
        }

        return load()
    }, [clearSelection, load])

    return {
        table,
        head,
        visibleHead,
        rows,
        clones,
        meta,
        links,
        loading,
        error,
        sort,
        orderBy,
        page,
        crudActions,
        bulkActions,
        rowActions,
        selectedIds,
        // Lo que devolvía la versión anterior, para quien lo lea desde fuera.
        dataTable: { head: visibleHead, body: rows },
        pagination: { meta, links },
        refresh,
        clearSelection,
        sortColumn,
        updatePage,
        preparePolicies,
        run,
        runBulk,
    }
}
