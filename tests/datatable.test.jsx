import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import axios from 'axios'

import DataTable from '../src/DataTable.jsx'
import { registerRoutes, resetRoutes } from '../src/routes.js'

vi.mock('axios')

/**
 * El contrato que el generador escribe en
 * `resources/<framework>/src/models/<entity>/index.js`. Es el mismo archivo
 * para Vue y para React.
 */
const makeModel = (overrides = {}) => ({
    crudActions: () => [
        { id: 'create', name: 'Crear', callback: null, icon: 'plus', route: true, policy: false, params: { to: { name: 'AdminCreatePost', params: {} } } },
        { id: 'export', name: 'Exportar', callback: 'exportModel', icon: 'download', route: false, policy: false, params: {} },
    ],
    dataTableHead: () => [
        { id: 'id', value: 'ID', sortable: true, html: false },
        { id: 'title', value: 'Title', sortable: true, html: false },
        { id: 'slug', value: 'Slug', sortable: false, html: false },
    ],
    dataTableSort: () => ({ title: 'asc' }),
    setFilters: vi.fn(),
    exportModel: vi.fn().mockResolvedValue({}),
    ...overrides,
})

const page = (rows) => ({
    data: {
        data: rows,
        meta: { current_page: 1, last_page: 3, from: 1, to: rows.length, total: 30 },
        links: [],
    },
})

const rows = [
    { id: 1, title: 'Primero', slug: 'primero', actions: [] },
    { id: 2, title: 'Segundo', slug: 'segundo', actions: [] },
]

const renderTable = (props = {}) => render(
    <MemoryRouter>
        <DataTable
            dataUrl="/api/posts/index"
            policyUrl="/api/posts/policies"
            model={makeModel()}
            {...props} />
    </MemoryRouter>
)

describe('DataTable', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetRoutes()
        axios.mockResolvedValue(page(rows))
    })

    it('carga y pinta las filas al montarse', async () => {
        renderTable()

        expect(await screen.findByText('Primero')).toBeInTheDocument()
        expect(screen.getByText('Segundo')).toBeInTheDocument()
    })

    it('pinta las columnas que declara el modelo', async () => {
        renderTable()

        await screen.findByText('Primero')

        expect(screen.getByRole('columnheader', { name: 'ID' })).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: 'Title' })).toBeInTheDocument()
    })

    it('respeta hideColumns escrito como lista de cadenas', async () => {
        renderTable({ hideColumns: ['slug'] })

        await screen.findByText('Primero')

        expect(screen.queryByRole('columnheader', { name: 'Slug' })).not.toBeInTheDocument()
    })

    /**
     * El contrato de hideColumns nunca estuvo documentado y por ahi circulan
     * las dos formas.
     */
    it('respeta hideColumns escrito como lista de objetos', async () => {
        renderTable({ hideColumns: [{ id: 'id' }] })

        await screen.findByText('Primero')

        expect(screen.queryByRole('columnheader', { name: 'ID' })).not.toBeInTheDocument()
    })

    it('ordena al pulsar una columna ordenable e invierte el sentido', async () => {
        renderTable()

        await screen.findByText('Primero')

        const calls = () => axios.mock.calls.map(([config]) => config.data?.orderMode)

        await userEvent.click(screen.getByRole('columnheader', { name: 'Title' }))

        await waitFor(() => expect(calls().at(-1)).toBe('desc'))

        await userEvent.click(screen.getByRole('columnheader', { name: 'Title' }))

        await waitFor(() => expect(calls().at(-1)).toBe('asc'))
    })

    it('no ordena por una columna que no es ordenable', async () => {
        renderTable()

        await screen.findByText('Primero')

        const before = axios.mock.calls.length

        await userEvent.click(screen.getByRole('columnheader', { name: 'Slug' }))

        expect(axios.mock.calls).toHaveLength(before)
    })

    it('manda el orden por defecto que declara el modelo', async () => {
        renderTable()

        await screen.findByText('Primero')

        expect(axios.mock.calls[0][0].data).toMatchObject({ orderBy: 'id', page: 1 })
    })

    it('cambia de pagina y lo pide al servidor', async () => {
        renderTable()

        await screen.findByText('Primero')

        await userEvent.selectOptions(screen.getByLabelText('Página'), '2')

        await waitFor(() => expect(axios.mock.calls.at(-1)[0].data.page).toBe(2))
    })

    /**
     * Un fallo de red no trae respuesta: leer error.response.status sin
     * comprobarlo lanzaba un TypeError dentro del propio manejador.
     */
    it('sobrevive a un fallo sin respuesta', async () => {
        axios.mockRejectedValueOnce(new Error('Network Error'))

        renderTable()

        await waitFor(() => expect(axios).toHaveBeenCalled())

        expect(screen.queryByText('Primero')).not.toBeInTheDocument()
    })

    it('un 403 no reintenta', async () => {
        axios.mockRejectedValue({ response: { status: 403 } })

        renderTable()

        await waitFor(() => expect(axios).toHaveBeenCalledTimes(1))

        // Si reintentara, en 2 s habria mas llamadas.
        await new Promise((resolve) => setTimeout(resolve, 50))

        expect(axios).toHaveBeenCalledTimes(1)
    })

    it('marca las acciones que el backend autoriza', async () => {
        registerRoutes({ AdminCreatePost: '/admin/posts/create' })

        axios.mockImplementation((config) => (
            config.url === '/api/posts/policies'
                ? Promise.resolve({ data: { create: true, export: false } })
                : Promise.resolve(page(rows))
        ))

        renderTable()

        await screen.findByText('Primero')

        await userEvent.click(screen.getByRole('button', { name: 'Acciones' }))

        // 'Crear' pasa a ser un enlace de verdad; 'Exportar' sigue deshabilitado.
        await waitFor(() => expect(screen.getByRole('link', { name: /Crear/ })).toHaveAttribute('href', '/admin/posts/create'))

        expect(screen.getByText('Exportar').closest('a')).toHaveAttribute('aria-disabled', 'true')
    })

    it('ejecuta el callback de una accion y recarga', async () => {
        const model = makeModel()

        axios.mockImplementation((config) => (
            config.url === '/api/posts/policies'
                ? Promise.resolve({ data: { export: true } })
                : Promise.resolve(page(rows))
        ))

        render(
            <MemoryRouter>
                <DataTable dataUrl="/api/posts/index" policyUrl="/api/posts/policies" model={model} />
            </MemoryRouter>
        )

        await screen.findByText('Primero')

        await userEvent.click(screen.getByRole('button', { name: 'Acciones' }))
        await waitFor(() => expect(screen.getByText('Exportar').closest('a')).not.toHaveAttribute('aria-disabled'))

        await userEvent.click(screen.getByText('Exportar'))

        await waitFor(() => expect(model.exportModel).toHaveBeenCalled())
    })

    it('aplica el parser de una columna sin tocar los datos de la fila', async () => {
        const model = makeModel({
            dataTableHead: () => [
                { id: 'id', value: 'ID', sortable: false },
                {
                    id: 'title',
                    value: 'Title',
                    sortable: false,
                    parser: (value, row) => {
                        row.title = 'MUTADO'

                        return value.toUpperCase()
                    },
                },
            ],
        })

        render(
            <MemoryRouter>
                <DataTable dataUrl="/api/posts/index" policyUrl="/api/posts/policies" model={model} />
            </MemoryRouter>
        )

        expect(await screen.findByText('PRIMERO')).toBeInTheDocument()
        expect(rows[0].title).toBe('Primero')
    })

    it('el formulario de filtros esta oculto hasta que se pide', async () => {
        renderTable({ filterForm: <p>Formulario</p> })

        await screen.findByText('Primero')

        expect(screen.getByText('Formulario').closest('.filter-form')).toHaveAttribute('hidden')

        await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))

        expect(screen.getByText('Formulario').closest('.filter-form')).not.toHaveAttribute('hidden')
    })

    it('sin acciones no pinta la columna de acciones', async () => {
        renderTable({ hasActions: false })

        await screen.findByText('Primero')

        expect(screen.queryByRole('button', { name: 'Acciones' })).not.toBeInTheDocument()
    })
})
