import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
    DEFAULT_LABELS,
    ariaSort,
    columnsFrom,
    componentProps,
    describeError,
    hiddenColumnIds,
    isCancelled,
    menuItems,
    requestFilters,
    routeTarget,
    summary,
    toggledSort,
    visibilityFrom,
    withPolicies,
} from '../src/table.js'

/**
 * Lo que la tabla decide sin React. El mismo archivo vive en
 * innoboxrr-vue-datatable, y estas pruebas también.
 */

beforeEach(() => {
    globalThis.csrf_token = 'tok-123'
})

describe('columnas', () => {
    it('traduce la cabecera del modelo a columnas de TanStack Table', () => {
        const parser = (value) => value
        const [id, name] = columnsFrom([
            { id: 'id', value: 'ID', sortable: true },
            { id: 'name', value: 'Nombre', parser },
        ])

        expect(id).toMatchObject({ id: 'id', header: 'ID', enableSorting: true })
        expect(name.enableSorting).toBe(false)
        expect(name.meta.head.parser).toBe(parser)
        expect(name.accessorFn({ name: 'Uno' })).toBe('Uno')
    })

    /**
     * El contrato de hideColumns nunca estuvo documentado y por ahí circulan
     * las dos formas.
     */
    it('acepta columnas ocultas como cadenas o como objetos', () => {
        expect(hiddenColumnIds(['name', { id: 'slug' }, null])).toEqual(['name', 'slug'])
        expect(visibilityFrom(['name'])).toEqual({ name: false })
    })
})

describe('orden', () => {
    it('la primera pulsacion deja ascendente y las siguientes alternan', () => {
        expect(toggledSort({}, 'name')).toEqual({ name: 'asc' })
        expect(toggledSort({ name: 'asc' }, 'name')).toEqual({ name: 'desc' })
        expect(toggledSort({ name: 'desc' }, 'name')).toEqual({ name: 'asc' })
    })

    it('solo una columna ordenable lleva aria-sort', () => {
        expect(ariaSort({ id: 'slug' }, 'id', {})).toBeUndefined()
        expect(ariaSort({ id: 'name', sortable: true }, 'id', {})).toBe('none')
        expect(ariaSort({ id: 'id', sortable: true }, 'id', { id: 'desc' })).toBe('descending')
    })
})

describe('peticion', () => {
    const base = { formFilters: { name: 'form' }, externalFilters: { orderBy: 'external' }, orderBy: 'id', sort: { id: 'asc' }, page: 2 }

    it('manda lo que espera el backend', () => {
        expect(requestFilters({ ...base, externalFilters: {} })).toEqual({
            _token: 'tok-123',
            managed: true,
            except_view_any: true,
            name: 'form',
            orderBy: 'id',
            orderMode: 'asc',
            page: 2,
        })
    })

    it('sin orden interno manda el de los filtros externos; con el, el del usuario', () => {
        expect(requestFilters({ ...base, internalSort: false }).orderBy).toBe('external')
        expect(requestFilters({ ...base, internalSort: true }).orderBy).toBe('id')
    })
})

describe('errores', () => {
    /**
     * Antes un 403 dejaba la tabla vacía con «No results found», como si no
     * hubiera registros.
     */
    it('un 403 dice que no hay permiso y no ofrece reintentar', () => {
        expect(describeError({ response: { status: 403 } })).toEqual({
            status: 403,
            message: DEFAULT_LABELS.forbidden,
            retryable: false,
        })
    })

    it('un fallo de red dice que no hubo conexion', () => {
        expect(describeError(new Error('Network Error')).message).toBe(DEFAULT_LABELS.offline)
    })

    it('usa el mensaje del servidor cuando lo hay', () => {
        expect(describeError({ response: { status: 422, data: { message: 'Nombre duplicado' } } }).message).toBe('Nombre duplicado')
    })

    it('un error de programa no se hace pasar por uno de conexion', () => {
        expect(describeError(new TypeError('x is undefined'), DEFAULT_LABELS, 'Falló').message).toBe('Falló')
    })

    it('una confirmacion cancelada no es un error', () => {
        expect(isCancelled(Object.assign(new Error(), { name: 'RequestCancelledError' }))).toBe(true)
        expect(isCancelled(new Error())).toBe(false)
    })
})

describe('acciones', () => {
    const actions = [
        { id: 'edit', name: 'Editar', icon: 'edit', route: true, policy: false, params: { to: { name: 'Edit', params: { id: 1 } } } },
        { id: 'delete', name: 'Borrar', icon: 'delete', route: false, policy: false, callback: 'deleteModel', params: { id: 1 } },
        { id: 'help', name: 'Ayuda', route: true, link: true, policy: true, params: { link: '/ayuda' } },
    ]

    it('marca lo que el backend permite y respeta lo que el modelo ya permite', () => {
        const allowed = withPolicies(actions, { edit: true, delete: false })

        expect(allowed.map((action) => action.policy)).toEqual([true, false, true])
        expect(actions[0].policy).toBe(false)
    })

    it('una accion sin permiso se ve deshabilitada y dice por que', () => {
        const run = vi.fn()
        const [edit, remove] = menuItems(withPolicies(actions, { edit: true }), DEFAULT_LABELS, run)

        expect(edit).toMatchObject({ label: 'Editar', disabled: false, danger: false })
        expect(remove).toMatchObject({ disabled: true, disabledReason: DEFAULT_LABELS.notAllowed, danger: true })

        edit.action()

        expect(run).toHaveBeenCalledWith(expect.objectContaining({ id: 'edit' }))
    })

    it('el destino de una ruta suma los params y la query extra', () => {
        expect(routeTarget(actions[0], { tenant: 't1' }, { tab: 'a' })).toEqual({
            name: 'Edit',
            params: { id: 1, tenant: 't1' },
            query: { tab: 'a' },
        })
    })
})

describe('celdas y pie', () => {
    it('un componente de celda recibe el objeto del parser o { value }', () => {
        expect(componentProps({ href: '/x' })).toEqual({ href: '/x' })
        expect(componentProps('ok')).toEqual({ value: 'ok' })
        expect(componentProps(['a'])).toEqual({ value: ['a'] })
    })

    it('resume cuantos registros se ven', () => {
        expect(summary({ total: 42, from: 1, to: 15 })).toBe('1–15 de 42')
        expect(summary({ total: 0 })).toBe(DEFAULT_LABELS.empty)
    })
})
