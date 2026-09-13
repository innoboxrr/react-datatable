import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import SelectPaginationComponent from '../src/components/SelectPaginationComponent.jsx'

const meta = { total: 42, from: 1, to: 15, current_page: 1, last_page: 3 }

const renderPager = (overrides = {}, onPageChange = vi.fn()) => ({
    onPageChange,
    ...render(<SelectPaginationComponent meta={{ ...meta, ...overrides }} onPageChange={onPageChange} />),
})

describe('SelectPaginationComponent', () => {
    it('resume cuantos registros se ven', () => {
        renderPager()

        expect(screen.getByText('1–15 de 42')).toBeInTheDocument()
    })

    it('sin registros lo dice', () => {
        renderPager({ total: 0, last_page: 1 })

        expect(screen.getByText('No hay resultados')).toBeInTheDocument()
    })

    it('con una sola pagina no hay paginador', () => {
        renderPager({ last_page: 1 })

        expect(screen.queryByLabelText('Página')).not.toBeInTheDocument()
    })

    it('ofrece una opcion por pagina', () => {
        renderPager()

        expect(screen.getAllByRole('option')).toHaveLength(3)
    })

    it('avisa al elegir otra pagina', async () => {
        const { onPageChange } = renderPager()

        await userEvent.selectOptions(screen.getByLabelText('Página'), '2')

        expect(onPageChange).toHaveBeenLastCalledWith(2)
    })

    it('las flechas se detienen en los extremos', async () => {
        const { onPageChange, unmount } = renderPager()

        expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()

        await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))

        expect(onPageChange).toHaveBeenLastCalledWith(2)

        unmount()
        renderPager({ current_page: 3 })

        expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled()
    })

    it('no guarda la pagina: sigue la que llega y no la devuelve', () => {
        const { onPageChange, rerender } = renderPager({ current_page: 2 })

        rerender(<SelectPaginationComponent meta={{ ...meta, current_page: 1 }} onPageChange={onPageChange} />)

        expect(screen.getByLabelText('Página')).toHaveValue('1')
        expect(onPageChange).not.toHaveBeenCalled()
    })
})
