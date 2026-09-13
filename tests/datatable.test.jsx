import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { getToasts, resetToasts } from 'innoboxrr-form-core'
import axios from 'axios'

import DataTable from '../src/DataTable.jsx'
import { registerRoutes, resetRoutes } from '../src/routes.js'

vi.mock('axios', () => ({ default: vi.fn() }))

// jsdom no mide ni tiene ResizeObserver: con Floating UI de verdad, abrir un
// menú no termina nunca. En un navegador lo coloca; aquí basta con saber que
// se abre.
vi.mock('@floating-ui/dom', () => ({
    autoUpdate: vi.fn((reference, floating, update) => {
        update()

        return () => {}
    }),
    computePosition: vi.fn(() => Promise.resolve({ x: 0, y: 0 })),
    flip: vi.fn(),
    offset: vi.fn(),
    shift: vi.fn(),
}))

const DATA_URL = '/api/posts/index'
const POLICY_URL = '/api/posts/policies'

const page = (rows = [], meta = {}) => ({
    data: {
        data: rows,
        meta: { total: rows.length, from: 1, to: rows.length, current_page: 1, last_page: 3, ...meta },
        links: [],
    },
})

const row = (id, name) => ({
    id,
    name,
    actions: [
        { id: 'view', name: 'Ver', icon: 'show', route: true, policy: false, params: { to: { name: 'Show', params: { id } } } },
        { id: 'delete', name: 'Borrar', icon: 'delete', route: false, policy: false, callback: 'deleteModel', params: { id } },
    ],
})

const makeModel = (overrides = {}) => ({
    crudActions: () => [
        { id: 'create', name: 'Crear', icon: 'plus', route: true, policy: false, params: { to: { name: 'Create', params: {} } } },
        { id: 'export', name: 'Exportar', icon: 'download', route: false, policy: false, callback: 'exportModel', params: {} },
    ],
    dataTableHead: () => [
        { id: 'id', value: 'ID', sortable: true, html: false },
        { id: 'name', value: 'Nombre', sortable: true, html: false },
    ],
    dataTableSort: () => ({ id: 'asc' }),
    setFilters: vi.fn(),
    deleteModel: vi.fn(() => Promise.resolve()),
    exportModel: vi.fn(() => Promise.resolve()),
    ...overrides,
})

const deferred = () => {
    let resolve

    const promise = new Promise((ok) => {
        resolve = ok
    })

    return { promise, resolve }
}

/** Responde datos o permisos según la URL, como el backend. */
const backend = ({ rows = [row(1, 'Uno'), row(2, 'Dos')], policies = {} } = {}) => (config) => (
    config.url === POLICY_URL
        ? Promise.resolve({ data: policies })
        : Promise.resolve(page(rows))
)

const dataCalls = () => axios.mock.calls.map(([config]) => config).filter((config) => config.url === DATA_URL)
const policyCalls = () => axios.mock.calls.map(([config]) => config).filter((config) => config.url === POLICY_URL)

/** Deja que terminen las promesas pendientes y lo que pintan. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function LocationProbe() {
    const location = useLocation()

    return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

const renderTable = async (props = {}, { model = makeModel() } = {}) => {
    const ref = createRef()

    const tree = (extra = {}) => (
        <MemoryRouter>
            <DataTable
                ref={ref}
                dataUrl={DATA_URL}
                dataMethod="get"
                policyUrl={POLICY_URL}
                policyMethod="get"
                model={model}
                {...props}
                {...extra} />
            <LocationProbe />
        </MemoryRouter>
    )

    const utils = render(tree())

    await settle()

    return {
        ...utils,
        ref,
        model,
        rerenderWith: async (extra) => {
            utils.rerender(tree(extra))
            await settle()
        },
    }
}

const openMenu = async (label) => {
    await userEvent.click(screen.getByRole('button', { name: label }))
    await settle()

    return screen.getByRole('menu', { name: label })
}

const menuItem = (menu, name) => within(menu).getByRole('menuitem', { name })

const headers = () => screen.getAllByRole('columnheader').map((th) => th.textContent)

beforeEach(() => {
    vi.clearAllMocks()
    resetToasts()
    resetRoutes()
    registerRoutes({ Show: '/posts/:id', Create: '/posts/create' })

    document.head.innerHTML = '<meta name="csrf-token" content="tok-123">'
    delete globalThis.csrf_token

    axios.mockImplementation(backend())
})

describe('carga', () => {
    it('pide los datos una vez al montarse y pinta las filas', async () => {
        await renderTable()

        expect(axios).toHaveBeenCalledTimes(1)
        expect(screen.getByText('Uno')).toBeInTheDocument()
        expect(screen.getByText('Dos')).toBeInTheDocument()
    })

    it('envia los filtros que espera el backend', async () => {
        await renderTable()

        expect(dataCalls()[0].params).toMatchObject({
            _token: 'tok-123',
            managed: true,
            except_view_any: true,
            orderBy: 'id',
            orderMode: 'asc',
            page: 1,
        })
    })

    it('usa data en lugar de params cuando el metodo es post', async () => {
        await renderTable({ dataMethod: 'post' })

        expect(dataCalls()[0]).toMatchObject({ method: 'post', params: null })
        expect(dataCalls()[0].data).not.toBeNull()
    })

    it('publica los filtros vigentes en el modelo', async () => {
        const { model } = await renderTable()

        expect(model.setFilters).toHaveBeenCalledWith(expect.objectContaining({ orderBy: 'id' }))
    })

    it('mientras llega la primera carga pinta la forma de las filas', async () => {
        const pending = deferred()

        axios.mockImplementationOnce(() => pending.promise)

        const { container } = await renderTable()

        expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(5)
        expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true')

        await act(async () => {
            pending.resolve(page([row(1, 'Uno')]))
        })
        await settle()

        expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(0)
        expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'false')
    })

    it('sin filas lo dice en el sitio de las filas', async () => {
        axios.mockImplementation(backend({ rows: [] }))

        const { container } = await renderTable()

        expect(container.querySelector('td.fe-table-empty')).toHaveTextContent('No hay resultados')
    })

    it('una respuesta que llega tarde no pisa a la ultima', async () => {
        await renderTable()

        const slow = deferred()
        const fast = deferred()

        axios.mockImplementationOnce(() => slow.promise).mockImplementationOnce(() => fast.promise)

        await userEvent.selectOptions(screen.getByLabelText('Página'), '2')
        await settle()
        await userEvent.selectOptions(screen.getByLabelText('Página'), '3')
        await settle()

        await act(async () => {
            fast.resolve(page([row(3, 'Tres')], { current_page: 3 }))
        })
        await settle()

        await act(async () => {
            slow.resolve(page([row(2, 'Vieja')], { current_page: 2 }))
        })
        await settle()

        expect(screen.getByText('Tres')).toBeInTheDocument()
        expect(screen.queryByText('Vieja')).not.toBeInTheDocument()
    })

    it('refresh() por ref vuelve a pedir la pagina', async () => {
        const { ref } = await renderTable()

        await act(() => ref.current.refresh())

        expect(dataCalls()).toHaveLength(2)
    })
})

describe('errores', () => {
    it('un 403 dice que no hay permiso y no reintenta', async () => {
        axios.mockRejectedValue({ response: { status: 403 } })

        const { container } = await renderTable()

        await act(() => new Promise((resolve) => setTimeout(resolve, 20)))

        expect(axios).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('alert')).toHaveTextContent('No tienes permiso para ver estos registros.')
        expect(container.querySelector('td.fe-table-empty button')).toBeNull()
        // Visto en el navegador: el pie decía «No hay resultados» debajo.
        expect(screen.queryByText('No hay resultados')).not.toBeInTheDocument()
    })

    it('un fallo de red se ve y se puede reintentar', async () => {
        axios.mockRejectedValueOnce(new Error('Network Error'))

        await renderTable()

        expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.')

        await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
        await settle()

        expect(dataCalls()).toHaveLength(2)
        expect(screen.getByText('Uno')).toBeInTheDocument()
    })

    it('un fallo al recargar avisa y deja las filas que habia', async () => {
        await renderTable()

        axios.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Server Error' } } })

        await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
        await settle()

        expect(getToasts()).toEqual([expect.objectContaining({ message: 'Server Error', variant: 'danger' })])
        expect(screen.getByText('Uno')).toBeInTheDocument()
    })
})

describe('columnas y orden', () => {
    it('pinta las cabeceras que declara el modelo', async () => {
        await renderTable()

        expect(headers()).toEqual(expect.arrayContaining(['ID', 'Nombre']))
    })

    it('oculta las columnas indicadas en hideColumns, como objetos o cadenas', async () => {
        const { rerenderWith } = await renderTable({ hideColumns: [{ id: 'name' }] })

        expect(headers()).not.toContain('Nombre')
        expect(within(screen.getAllByRole('row')[1]).getAllByRole('cell')).toHaveLength(2)

        await rerenderWith({ hideColumns: ['id'] })

        expect(headers()).toContain('Nombre')
        expect(headers()).not.toContain('ID')
        expect(within(screen.getAllByRole('row')[1]).getByText('Uno')).toBeInTheDocument()
    })

    it('invierte el orden al pulsar una columna ordenable', async () => {
        await renderTable()

        expect(screen.getByRole('columnheader', { name: 'ID' })).toHaveAttribute('aria-sort', 'ascending')

        await userEvent.click(screen.getByRole('button', { name: 'ID' }))
        await settle()

        expect(dataCalls().at(-1).params.orderMode).toBe('desc')
        expect(screen.getByRole('columnheader', { name: 'ID' })).toHaveAttribute('aria-sort', 'descending')

        await userEvent.click(screen.getByRole('button', { name: 'ID' }))
        await settle()

        expect(dataCalls().at(-1).params.orderMode).toBe('asc')
    })

    it('ordena por la columna pulsada con una sola peticion', async () => {
        await renderTable()

        await userEvent.click(screen.getByRole('button', { name: 'Nombre' }))
        await settle()

        expect(dataCalls()).toHaveLength(2)
        expect(dataCalls().at(-1).params.orderBy).toBe('name')
        expect(screen.getByRole('columnheader', { name: 'Nombre' })).toHaveAttribute('aria-sort', 'ascending')
        expect(screen.getByRole('columnheader', { name: 'ID' })).toHaveAttribute('aria-sort', 'none')
    })

    it('una columna que no se ordena no tiene boton ni aria-sort', async () => {
        await renderTable({}, {
            model: makeModel({ dataTableHead: () => [{ id: 'name', value: 'Nombre', sortable: false }] }),
        })

        expect(screen.queryByRole('button', { name: 'Nombre' })).not.toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: 'Nombre' })).not.toHaveAttribute('aria-sort')
    })
})

describe('filtros y paginas', () => {
    it('un filtro nuevo vuelve a la primera pagina con una sola peticion', async () => {
        const { rerenderWith } = await renderTable()

        await userEvent.selectOptions(screen.getByLabelText('Página'), '2')
        await settle()

        expect(dataCalls().at(-1).params.page).toBe(2)

        const before = dataCalls().length

        await rerenderWith({ formFilters: { name: 'Uno' } })
        await settle()

        expect(dataCalls()).toHaveLength(before + 1)
        expect(dataCalls().at(-1).params).toMatchObject({ name: 'Uno', page: 1 })
    })

    it('un filtro externo recarga sin cambiar de pagina', async () => {
        const { rerenderWith } = await renderTable()

        await userEvent.selectOptions(screen.getByLabelText('Página'), '2')
        await settle()

        await rerenderWith({ externalFilters: { status: 'active' } })

        expect(dataCalls().at(-1).params).toMatchObject({ status: 'active', page: 2 })
    })

    it('los mismos filtros en otro objeto no recargan', async () => {
        const { rerenderWith } = await renderTable({ formFilters: { name: 'Uno' } })

        await rerenderWith({ formFilters: { name: 'Uno' } })

        expect(dataCalls()).toHaveLength(1)
    })

    it('el panel de filtros esta oculto hasta que se pide', async () => {
        await renderTable({ filterForm: <p>Formulario</p> })

        expect(screen.getByText('Formulario').closest('.filter-form')).toHaveAttribute('hidden')

        await userEvent.click(screen.getByRole('button', { name: 'Filtros' }))

        expect(screen.getByText('Formulario').closest('.filter-form')).not.toHaveAttribute('hidden')
        expect(screen.getByRole('button', { name: 'Filtros' })).toHaveAttribute('aria-expanded', 'true')
    })

    it('no pinta la barra superior cuando se desactiva', async () => {
        const { container } = await renderTable({ showTopbar: false })

        expect(container.querySelector('.filter-form')).toBeNull()
        expect(screen.queryByRole('button', { name: 'Actualizar' })).not.toBeInTheDocument()
    })
})

describe('permisos y acciones', () => {
    it('pregunta los permisos de la barra antes de abrir su menu', async () => {
        axios.mockImplementation(backend({ policies: { create: true, export: false } }))

        await renderTable()

        const menu = await openMenu('Acciones')

        expect(policyCalls()).toHaveLength(1)
        expect(policyCalls()[0].params).toMatchObject({ id: null })
        expect(menu).not.toHaveAttribute('hidden')
        expect(menuItem(menu, 'Crear')).not.toHaveAttribute('aria-disabled')
        expect(menuItem(menu, 'Exportar')).toHaveAttribute('aria-disabled', 'true')
        expect(menuItem(menu, 'Exportar')).toHaveAttribute('data-tooltip', 'No tienes permiso para esta acción.')
    })

    it('pregunta los permisos de una fila con su id, una sola vez por carga', async () => {
        axios.mockImplementation(backend({ policies: { view: true } }))

        await renderTable()

        const menu = await openMenu('Acciones del registro 1')

        expect(policyCalls()[0].params).toMatchObject({ id: 1 })
        expect(menuItem(menu, 'Ver')).not.toHaveAttribute('aria-disabled')
        expect(menuItem(menu, 'Borrar')).toHaveAttribute('aria-disabled', 'true')

        // Cerrar y volver a abrir no vuelve a preguntar.
        await userEvent.click(screen.getByRole('button', { name: 'Acciones del registro 1' }))
        await settle()
        await openMenu('Acciones del registro 1')

        expect(policyCalls()).toHaveLength(1)
    })

    it('si no se pueden comprobar los permisos avisa y abre con todo deshabilitado', async () => {
        axios.mockImplementation((config) => (
            config.url === POLICY_URL ? Promise.reject(new Error('Network Error')) : Promise.resolve(page([row(1, 'Uno')]))
        ))

        await renderTable()

        const menu = await openMenu('Acciones del registro 1')

        expect(getToasts()).toEqual([expect.objectContaining({ message: 'No se pudieron comprobar los permisos.' })])
        expect(menu).not.toHaveAttribute('hidden')
        expect(within(menu).getAllByRole('menuitem').every((item) => item.getAttribute('aria-disabled') === 'true')).toBe(true)
    })

    it('ejecuta el callback de una accion y recarga', async () => {
        axios.mockImplementation(backend({ policies: { delete: true } }))

        const { model } = await renderTable()

        await userEvent.click(menuItem(await openMenu('Acciones del registro 1'), 'Borrar'))
        await settle()

        expect(model.deleteModel).toHaveBeenCalledWith({ id: 1 })
        expect(dataCalls()).toHaveLength(2)
    })

    it('una confirmacion cancelada no avisa ni recarga', async () => {
        axios.mockImplementation(backend({ policies: { delete: true } }))

        const model = makeModel({
            deleteModel: vi.fn(() => Promise.reject(Object.assign(new Error('cancelada'), { name: 'RequestCancelledError' }))),
        })

        await renderTable({}, { model })

        await userEvent.click(menuItem(await openMenu('Acciones del registro 1'), 'Borrar'))
        await settle()

        expect(getToasts()).toEqual([])
        expect(dataCalls()).toHaveLength(1)
    })

    it('una accion que falla dice por que', async () => {
        axios.mockImplementation(backend({ policies: { delete: true } }))

        const model = makeModel({
            deleteModel: vi.fn(() => Promise.reject({ response: { status: 422, data: { message: 'Tiene pedidos' } } })),
        })

        await renderTable({}, { model })

        await userEvent.click(menuItem(await openMenu('Acciones del registro 1'), 'Borrar'))
        await settle()

        expect(getToasts()).toEqual([expect.objectContaining({ message: 'Tiene pedidos', variant: 'danger' })])
    })

    it('una accion de ruta navega con los params extra', async () => {
        axios.mockImplementation(backend({ policies: { view: true } }))

        await renderTable({ extraParams: { tenant: 't1' } })

        await userEvent.click(menuItem(await openMenu('Acciones del registro 2'), 'Ver'))
        await settle()

        expect(screen.getByTestId('location')).toHaveTextContent('/posts/2?tenant=t1')
    })

    it('una ruta sin registrar avisa en vez de romper la tabla', async () => {
        axios.mockImplementation(backend({ policies: { view: true } }))
        resetRoutes()

        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

        await renderTable()

        await userEvent.click(menuItem(await openMenu('Acciones del registro 1'), 'Ver'))
        await settle()

        expect(getToasts()).toEqual([expect.objectContaining({ message: 'No se pudo completar la acción.' })])
        expect(consoleError).toHaveBeenCalled()

        consoleError.mockRestore()
    })

    it('sin acciones no pinta menus', async () => {
        await renderTable({ hasActions: false })

        expect(screen.queryByRole('button', { name: 'Acciones' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Acciones del registro 1' })).not.toBeInTheDocument()
    })
})

describe('seleccion', () => {
    const selectableModel = () => makeModel({
        bulkActions: () => [{ id: 'delete', name: 'Borrar seleccionados', callback: 'bulkDelete', danger: true, params: { permanently: false } }],
        bulkDelete: vi.fn(() => Promise.resolve()),
    })

    it('sin selectable no hay casillas', async () => {
        await renderTable()

        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('seleccionar filas muestra cuantas hay y que hacer con ellas', async () => {
        const { ref } = await renderTable({ selectable: true }, { model: selectableModel() })

        expect(screen.queryByRole('region')).not.toBeInTheDocument()

        await userEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar el registro 1' }))

        expect(screen.getByRole('region')).toHaveTextContent('1 seleccionados')
        expect(screen.getAllByRole('row')[1]).toHaveAttribute('data-selected', 'true')

        await userEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar todos los de esta página' }))

        expect(screen.getByRole('region')).toHaveTextContent('2 seleccionados')

        await userEvent.click(screen.getByRole('button', { name: 'Quitar selección' }))

        expect(screen.queryByRole('region')).not.toBeInTheDocument()
        expect(ref.current.selectedIds).toEqual([])
    })

    it('la casilla general queda a medias con parte de la pagina elegida', async () => {
        await renderTable({ selectable: true })

        await userEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar el registro 2' }))

        expect(screen.getByRole('checkbox', { name: 'Seleccionar todos los de esta página' }).indeterminate).toBe(true)
    })

    it('una accion masiva recibe los ids y las filas, limpia la seleccion y recarga', async () => {
        const model = selectableModel()
        const { ref } = await renderTable({ selectable: true }, { model })

        await userEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar todos los de esta página' }))
        await userEvent.click(screen.getByRole('button', { name: 'Borrar seleccionados' }))
        await settle()

        expect(model.bulkDelete).toHaveBeenCalledWith(['1', '2'], [expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 2 })], { permanently: false })
        expect(ref.current.selectedIds).toEqual([])
        expect(dataCalls()).toHaveLength(2)
    })

    it('un filtro nuevo descarta la seleccion', async () => {
        const { ref, rerenderWith } = await renderTable({ selectable: true })

        await userEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar el registro 1' }))
        await rerenderWith({ formFilters: { name: 'x' } })

        expect(ref.current.selectedIds).toEqual([])
    })
})

describe('celdas', () => {
    it('un componente de celda recibe su valor y avisa con onCallback', async () => {
        const callback = vi.fn()

        axios.mockImplementation(backend({ rows: [{ id: 1, status: 'ok', actions: [] }] }))

        await renderTable({}, {
            model: makeModel({
                dataTableHead: () => [{ id: 'status', value: 'Estado', component: 'Badge', callback }],
                dataTableComponents: () => ({
                    Badge: ({ value, onCallback }) => (
                        <button type="button" className="badge" onClick={() => onCallback(value)}>{value}</button>
                    ),
                }),
            }),
        })

        await userEvent.click(screen.getByRole('button', { name: 'ok' }))

        expect(callback).toHaveBeenCalledWith('ok', expect.objectContaining({ id: 1 }))
    })

    it('una columna html se pinta como html', async () => {
        axios.mockImplementation(backend({ rows: [{ id: 1, name: '<strong>Uno</strong>', actions: [] }] }))

        const { container } = await renderTable({}, {
            model: makeModel({ dataTableHead: () => [{ id: 'name', value: 'Nombre', html: true }] }),
        })

        expect(container.querySelector('tbody strong')).toHaveTextContent('Uno')
    })
})

describe('aislamiento de las filas', () => {
    it('un parser que muta su fila no toca los datos de la tabla', async () => {
        const rows = [{ id: 1, name: 'Original', actions: [] }]

        axios.mockImplementation(backend({ rows }))

        await renderTable({}, {
            model: makeModel({
                dataTableHead: () => [{
                    id: 'name',
                    value: 'Nombre',
                    parser: (value, fila) => {
                        fila.name = 'MUTADO'

                        return String(value).toUpperCase()
                    },
                }],
            }),
        })

        expect(screen.getByText('ORIGINAL')).toBeInTheDocument()
        expect(rows[0].name).toBe('Original')
    })
})
