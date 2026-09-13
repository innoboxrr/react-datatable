import IconComponent from 'innoboxrr-react-form-elements/src/IconComponent.jsx'

import { DEFAULT_LABELS, summary } from '../table.js'
import useTheme from '../useTheme.js'

/**
 * Gemelo de SelectPaginationComponent.vue: cuántos registros se ven y en qué
 * página se está.
 *
 * No guarda la página: la dueña es la tabla, y una copia local se
 * desincronizaba cuando la página cambiaba desde fuera.
 */
export default function SelectPaginationComponent({ meta = {}, labels = null, onPageChange }) {
    const theme = useTheme()
    const text = { ...DEFAULT_LABELS, ...(labels ?? {}) }

    const current = Number(meta?.current_page ?? 1)
    const last = Number(meta?.last_page ?? 1)

    const go = (value) => {
        const page = Number(value)

        if (page >= 1 && page <= last && page !== current) {
            onPageChange?.(page)
        }
    }

    return (
        <div className={theme.tableFooter}>
            <span>{summary(meta ?? {}, text)}</span>

            {last > 1 ? (
                <div className={theme.tablePager}>
                    <button
                        type="button"
                        className={theme.iconButton}
                        aria-label={text.previous}
                        disabled={current <= 1}
                        onClick={() => go(current - 1)}>
                        <IconComponent name="previous" size={14} />
                    </button>

                    <select
                        className={theme.select}
                        aria-label={text.page}
                        value={current}
                        onChange={(event) => go(event.target.value)}>
                        {Array.from({ length: last }, (_, index) => index + 1).map((page) => (
                            <option key={page} value={page}>{page}</option>
                        ))}
                    </select>

                    <span>{text.of} {last}</span>

                    <button
                        type="button"
                        className={theme.iconButton}
                        aria-label={text.next}
                        disabled={current >= last}
                        onClick={() => go(current + 1)}>
                        <IconComponent name="next" size={14} />
                    </button>
                </div>
            ) : null}
        </div>
    )
}
