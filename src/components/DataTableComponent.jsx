import { useMemo } from 'react'
import ActionListComponent from './ActionListComponent.jsx'
import DatatableIcon from './DatatableIcon.jsx'
import NavDropdownComponent from './NavDropdownComponent.jsx'

const cellValue = (head, row) => (
    typeof head.parser === 'function' ? head.parser(row[head.id], row) : row[head.id]
)

/**
 * Gemelo de DataTableComponent.vue: la tabla propiamente dicha.
 */
export default function DataTableComponent({
    actions = false,
    dataTable,
    extraParams = {},
    extraQuery = {},
    showTableHeader = true,
    dataTableComponents = {},
    onSortColumn,
    onActionButtonClicked,
    onActionClicked,
}) {
    const head = useMemo(() => dataTable.head ?? [], [dataTable.head])

    /**
     * Copia aislada de cada fila, para que un parser del modelo no pueda mutar
     * los datos de la tabla.
     *
     * La versión Vue clona con JSON dentro de setData(), es decir una vez por
     * celda: con 20 filas y 8 columnas son 160 clonados en cada repintado. Un
     * clon por fila y repintado deja lo mismo en 20 — y, a diferencia de una
     * caché de módulo, un parser que escriba en su copia no la envenena para
     * los repintados siguientes.
     */
    const body = useMemo(
        () => (dataTable.body ?? []).map((row) => structuredClone(row)),
        [dataTable.body]
    )

    return (
        <div className="sm:rounded-lg overflow-x-auto">
            <table className="min-w-full w-full text-sm text-left text-slate-500 dark:text-slate-400 p-4">
                {showTableHeader ? (
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 rounded-sm">
                        <tr>
                            {head.map((column) => (
                                <th
                                    key={column.id}
                                    id={`th_${column.id}`}
                                    className={`px-6 py-3${column.sortable ? ' pointer' : ''}`}
                                    scope="col"
                                    onClick={() => onSortColumn?.(column)}>
                                    {column.value}
                                </th>
                            ))}
                            {actions ? <th className="fe-shrink"></th> : null}
                        </tr>
                    </thead>
                ) : null}

                <tbody>
                    {(dataTable.body ?? []).map((row, index) => (
                        <tr
                            key={row.id}
                            className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                            {head.map((column) => {
                                // Las celdas leen de la copia; las acciones,
                                // de la fila real, porque su identidad es lo
                                // que el hook usa para sustituirlas al
                                // resolver las politicas.
                                const value = cellValue(column, body[index] ?? row)
                                const Component = column.component ? dataTableComponents[column.component] : null

                                return (
                                    <td key={column.id} className="px-6 py-4">
                                        {Component ? (
                                            <Component
                                                {...(typeof value === 'object' && value !== null ? value : { value })}
                                                onCallback={(payload) => (
                                                    typeof column.callback === 'function'
                                                        ? column.callback(payload, row)
                                                        : null
                                                )} />
                                        ) : column.html ? (
                                            <span className="dark:text-white" dangerouslySetInnerHTML={{ __html: value }}></span>
                                        ) : (
                                            <span className="dark:text-white">{value}</span>
                                        )}
                                    </td>
                                )
                            })}

                            {actions ? (
                                <td className="fe-text-right">
                                    <button
                                        type="button"
                                        aria-label={`Acciones del registro ${row.id}`}
                                        className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-2 py-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800"
                                        popoverTarget={`dropdown_${row.id}`}
                                        onClick={() => onActionButtonClicked?.(row.actions)}>
                                        <DatatableIcon icon="actions" />
                                    </button>

                                    <NavDropdownComponent id={`dropdown_${row.id}`} pos="left">
                                        <ActionListComponent
                                            actions={row.actions ?? []}
                                            extraParams={extraParams}
                                            extraQuery={extraQuery}
                                            onActionClicked={onActionClicked} />
                                    </NavDropdownComponent>
                                </td>
                            ) : null}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
