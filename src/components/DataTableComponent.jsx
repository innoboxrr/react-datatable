import IconComponent from 'innoboxrr-react-form-elements/src/IconComponent.jsx'
import MenuComponent from 'innoboxrr-react-form-elements/src/MenuComponent.jsx'
import SkeletonComponent from 'innoboxrr-react-form-elements/src/SkeletonComponent.jsx'

import { DEFAULT_LABELS, ariaSort, cellValue, componentProps, sortIcon } from '../table.js'
import useTheme from '../useTheme.js'

const SKELETON_ROWS = 5

const headOf = (cell) => cell.column.columnDef.meta?.head ?? {}

/**
 * Gemelo de DataTableComponent.vue: la tabla propiamente dicha, sobre una
 * instancia de TanStack Table.
 *
 * El menú de cada fila espera a conocer los permisos antes de abrirse. Antes
 * se abría al instante con todo deshabilitado y se habilitaba cuando llegaba
 * la respuesta, y el usuario veía parpadear lo que no podía hacer.
 */
export default function DataTableComponent({
    table,
    head = [],
    rows = [],
    clones = [],
    loading = false,
    error = null,
    actions = false,
    selectable = false,
    showTableHeader = true,
    dataTableComponents = {},
    labels = DEFAULT_LABELS,
    orderBy = null,
    sort = {},
    itemsFor = () => [],
    prepareRow = async () => {},
    onSortColumn,
    onRetry,
}) {
    const theme = useTheme()

    const colspan = head.length + (selectable ? 1 : 0) + (actions ? 1 : 0)

    const allSelected = rows.length > 0 && table.getIsAllPageRowsSelected()
    const someSelected = table.getIsSomePageRowsSelected() && ! allSelected

    const renderCell = (cell, row) => {
        const column = headOf(cell)
        const Component = column.component ? (dataTableComponents[column.component] ?? null) : null

        if (Component) {
            return (
                <Component
                    {...componentProps(cellValue(column, clones[row.index] ?? row.original))}
                    onCallback={(payload) => (
                        typeof column.callback === 'function' ? column.callback(payload, row.original) : null
                    )} />
            )
        }

        const value = cellValue(column, clones[row.index] ?? row.original)

        return column.html ? <span dangerouslySetInnerHTML={{ __html: value }} /> : value
    }

    const renderBody = () => {
        // Primera carga: la forma de las filas, mientras llegan.
        if (loading && rows.length === 0) {
            return Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <tr key={`skeleton-${index}`} data-skeleton="true">
                    {selectable ? <td className={theme.tableSelect} /> : null}
                    {head.map((column) => (
                        <td key={column.id}><SkeletonComponent /></td>
                    ))}
                    {actions ? <td className={theme.tableSelect} /> : null}
                </tr>
            ))
        }

        // Sin filas se dice por qué: no es lo mismo vacío que prohibido.
        if (rows.length === 0) {
            return (
                <tr>
                    <td colSpan={colspan} className={theme.tableEmpty}>
                        {error ? (
                            <>
                                <span role="alert">{error.message}</span>
                                {error.retryable ? (
                                    <button type="button" className={theme.buttonLink} onClick={() => onRetry?.()}>
                                        {labels.retry}
                                    </button>
                                ) : null}
                            </>
                        ) : labels.empty}
                    </td>
                </tr>
            )
        }

        return table.getRowModel().rows.map((row) => (
            <tr key={row.id} data-selected={row.getIsSelected() ? 'true' : undefined}>
                {selectable ? (
                    <td className={theme.tableSelect}>
                        <input
                            type="checkbox"
                            className={theme.checkbox}
                            aria-label={`${labels.selectRow} ${row.original.id}`}
                            checked={row.getIsSelected()}
                            onChange={row.getToggleSelectedHandler()} />
                    </td>
                ) : null}

                {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={headOf(cell).numeric ? theme.tableNumeric : undefined}>
                        {renderCell(cell, row)}
                    </td>
                ))}

                {actions ? (
                    <td className={theme.tableSelect}>
                        <MenuComponent
                            items={itemsFor(row.original)}
                            label={`${labels.rowActions} ${row.original.id}`}
                            beforeOpen={() => prepareRow(row.original.id)} />
                    </td>
                ) : null}
            </tr>
        ))
    }

    return (
        <div className={theme.tableContainer}>
            <table className={[theme.table, theme.tableSticky].filter(Boolean).join(' ')} aria-busy={loading ? 'true' : 'false'}>
                {showTableHeader ? (
                    <thead>
                        <tr>
                            {selectable ? (
                                <th scope="col" className={theme.tableSelect}>
                                    <input
                                        type="checkbox"
                                        className={theme.checkbox}
                                        aria-label={labels.selectAll}
                                        checked={allSelected}
                                        // React no tiene prop para esto: es una propiedad del DOM.
                                        ref={(element) => {
                                            if (element) {
                                                element.indeterminate = someSelected
                                            }
                                        }}
                                        disabled={rows.length === 0}
                                        onChange={(event) => table.toggleAllPageRowsSelected(event.target.checked)} />
                                </th>
                            ) : null}

                            {head.map((column) => (
                                <th
                                    key={column.id}
                                    id={`th_${column.id}`}
                                    scope="col"
                                    className={column.numeric ? theme.tableNumeric : undefined}
                                    aria-sort={ariaSort(column, orderBy, sort)}>
                                    {column.sortable === true ? (
                                        <button type="button" className={theme.tableSort} onClick={() => onSortColumn?.(column)}>
                                            <span>{column.value}</span>
                                            <IconComponent name={sortIcon(column, orderBy, sort)} size={12} />
                                        </button>
                                    ) : column.value}
                                </th>
                            ))}

                            {actions ? <th scope="col" className={theme.tableSelect} aria-label={labels.actions} /> : null}
                        </tr>
                    </thead>
                ) : null}

                <tbody>{renderBody()}</tbody>
            </table>
        </div>
    )
}
