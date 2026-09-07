import { useState } from 'react'
import ActionListComponent from './components/ActionListComponent.jsx'
import DataTableComponent from './components/DataTableComponent.jsx'
import NavDropdownComponent from './components/NavDropdownComponent.jsx'
import SelectPaginationComponent from './components/SelectPaginationComponent.jsx'
import useDataTable from './useDataTable.js'

/**
 * Gemelo de DataTable.vue.
 *
 * `model` es el contrato de `resources/<framework>/src/models/<entity>/
 * index.js`, que es **el mismo archivo** para Vue y para React: funciones
 * puras y llamadas HTTP, sin nada de un framework de UI. Por eso este
 * componente recibe exactamente los mismos props que su gemelo.
 *
 * La única diferencia real: el slot `filterForm` de Vue aquí es el prop
 * `filterForm`, porque React no tiene slots con nombre.
 */
export default function DataTable({
    dataUrl,
    dataMethod = 'post',
    model,
    policyUrl,
    policyMethod = 'post',
    showTopbar = true,
    hasActions = true,
    hasFilter = true,
    formFilters = {},
    externalFilters = {},
    extraParams = {},
    extraQuery = {},
    hideColumns = [],
    cardWrapper = true,
    showTableHeader = true,
    filterForm = null,
}) {
    const [filtersOpen, setFiltersOpen] = useState(false)

    const {
        dataTable,
        pagination,
        crudActions,
        updateFilters,
        sortColumn,
        updatePage,
        actionClicked,
        actionButtonClicked,
    } = useDataTable({
        dataUrl,
        dataMethod,
        model,
        policyUrl,
        policyMethod,
        formFilters,
        externalFilters,
        hideColumns,
    })

    const dataTableComponents = typeof model.dataTableComponents === 'function'
        ? model.dataTableComponents()
        : {}

    return (
        <div>
            {showTopbar ? (
                <div>
                    <div className="fe-container fe-container-wide pt-4">
                        <div fe-grid="">
                            {hasActions ? (
                                <div className="fe-w-expand">
                                    <button
                                        type="button"
                                        className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800"
                                        onClick={() => actionButtonClicked(crudActions)}>
                                        Acciones
                                    </button>

                                    <NavDropdownComponent id="actionCrudDropdown" pos="right">
                                        <ActionListComponent
                                            actions={crudActions}
                                            extraParams={extraParams}
                                            extraQuery={extraQuery}
                                            onActionClicked={actionClicked} />
                                    </NavDropdownComponent>
                                </div>
                            ) : (
                                <div><div className="fe-w-expand"></div></div>
                            )}

                            {hasFilter ? (
                                <div className="fe-w-auto">
                                    <div className="fe-grid-divider fe-children-expand fe-text-center" fe-grid="">
                                        <div>
                                            <button
                                                type="button"
                                                aria-label="Update results"
                                                className="fe-text-right pointer"
                                                onClick={updateFilters}>
                                                <svg className="w-6 h-6 text-slate-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 18 20">
                                                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 1v5h-5M2 19v-5h5m10-4a8 8 0 0 1-14.947 3.97M1 10a8 8 0 0 1 14.947-3.97" />
                                                </svg>
                                            </button>
                                        </div>

                                        <div>
                                            <button
                                                type="button"
                                                aria-label="Buscar"
                                                aria-expanded={filtersOpen}
                                                className="fe-text-right pointer"
                                                onClick={() => setFiltersOpen((open) => ! open)}>
                                                <svg className="w-6 h-6 text-slate-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 18">
                                                    <path d="M18.85 1.1A1.99 1.99 0 0 0 17.063 0H2.937a2 2 0 0 0-1.566 3.242L6.99 9.868 7 14a1 1 0 0 0 .4.8l4 3A1 1 0 0 0 13 17l.01-7.134 5.66-6.676a1.99 1.99 0 0 0 .18-2.09Z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {hasFilter ? (
                        // El uk-toggle de la version Vue trabaja sobre el DOM
                        // por su cuenta; en React el estado gobierna la vista.
                        <div className="filter-form fe-card fe-card-body fe-pt-0" hidden={! filtersOpen}>
                            {filterForm}
                        </div>
                    ) : null}
                </div>
            ) : null}

            <div className={`fe-container fe-container-wide${showTopbar ? ' ptb-20' : ''}`}>
                <div className={`fe-p-sm${cardWrapper ? ' bg-white p-6 rounded-lg shadow dark:border-slate-700 dark:bg-slate-800' : ''}`}>
                    <DataTableComponent
                        actions={hasActions}
                        dataTable={dataTable}
                        extraParams={extraParams}
                        extraQuery={extraQuery}
                        showTableHeader={showTableHeader}
                        dataTableComponents={dataTableComponents}
                        onSortColumn={sortColumn}
                        onActionButtonClicked={actionButtonClicked}
                        onActionClicked={actionClicked} />

                    <SelectPaginationComponent meta={pagination.meta} onPageChange={updatePage} />
                </div>
            </div>
        </div>
    )
}
