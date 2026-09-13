import { useCallback, useId, useImperativeHandle, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IconComponent from 'innoboxrr-react-form-elements/src/IconComponent.jsx'
import MenuComponent from 'innoboxrr-react-form-elements/src/MenuComponent.jsx'

import DataTableComponent from './components/DataTableComponent.jsx'
import SelectPaginationComponent from './components/SelectPaginationComponent.jsx'
import { buildPath } from './routes.js'
import { DEFAULT_LABELS, menuItems } from './table.js'
import useDataTable from './useDataTable.js'
import useTheme, { joinClasses } from './useTheme.js'

/**
 * Gemelo de DataTable.vue.
 *
 * `model` es el contrato de `resources/<framework>/src/models/<entity>/
 * index.js`, que es **el mismo archivo** para Vue y para React: funciones
 * puras y llamadas HTTP, sin nada de un framework de UI. Por eso este
 * componente recibe exactamente los mismos props que su gemelo.
 *
 * Las diferencias son de React: el slot `filterForm` es un prop, y lo que Vue
 * expone con defineExpose —`refresh()`, `clearSelection()`— llega por `ref`.
 */
export default function DataTable({
    ref = null,
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
    selectable = false,
    labels = null,
    filterForm = null,
}) {
    const theme = useTheme()
    const routerNavigate = useNavigate()

    const [filtersOpen, setFiltersOpen] = useState(false)
    const filtersId = useId()

    const text = useMemo(() => ({ ...DEFAULT_LABELS, ...(labels ?? {}) }), [labels])

    // React Router no tiene rutas con nombre: el contrato apunta a un nombre y
    // `registerRoutes` dice a qué patrón corresponde.
    const navigate = useCallback(
        (target) => routerNavigate(buildPath(target.name, target.params, target.query)),
        [routerNavigate]
    )

    const {
        table,
        visibleHead,
        rows,
        clones,
        meta,
        loading,
        error,
        sort,
        orderBy,
        crudActions,
        bulkActions,
        rowActions,
        selectedIds,
        refresh,
        clearSelection,
        sortColumn,
        updatePage,
        preparePolicies,
        run,
        runBulk,
    } = useDataTable({
        dataUrl,
        dataMethod,
        model,
        policyUrl,
        policyMethod,
        formFilters,
        externalFilters,
        extraParams,
        extraQuery,
        hideColumns,
        selectable,
        labels: text,
        navigate,
    })

    useImperativeHandle(ref, () => ({ refresh, clearSelection, selectedIds, table }), [refresh, clearSelection, selectedIds, table])

    const dataTableComponents = useMemo(
        () => (typeof model.dataTableComponents === 'function' ? model.dataTableComponents() : {}),
        [model]
    )

    const crudItems = useMemo(() => menuItems(crudActions, text, run), [crudActions, text, run])
    const rowItems = useCallback((row) => menuItems(rowActions(row), text, run), [rowActions, text, run])
    const prepareCrud = useCallback(() => preparePolicies(null), [preparePolicies])

    const bulkVisible = selectable && selectedIds.length > 0

    const renderBar = () => {
        // Con filas seleccionadas, la barra dice cuántas y qué hacer con ellas,
        // en el mismo sitio que la de siempre para que la tabla no salte.
        if (bulkVisible) {
            return (
                <div className={theme.bulkBar} role="region" aria-label={text.selection}>
                    <span className={theme.bulkCount} aria-live="polite">{selectedIds.length} {text.selected}</span>

                    {bulkActions.map((action) => (
                        <button
                            key={action.id ?? action.name}
                            type="button"
                            className={joinClasses(action.danger ? theme.buttonDanger : theme.buttonSecondary, 'fe-button-sm')}
                            onClick={() => runBulk(action)}>
                            {action.icon ? <IconComponent name={action.icon} size={14} /> : null}
                            <span>{action.name}</span>
                        </button>
                    ))}

                    <span className={theme.toolbarSpacer} />

                    <button type="button" className={theme.buttonLink} onClick={() => clearSelection()}>
                        {text.clearSelection}
                    </button>
                </div>
            )
        }

        if (! showTopbar) {
            return null
        }

        return (
            <div className={theme.toolbar}>
                {hasActions ? (
                    <MenuComponent
                        items={crudItems}
                        label={text.actions}
                        placement="bottom-start"
                        beforeOpen={prepareCrud}
                        renderTrigger={({ toggle, loading: busy, triggerProps }) => (
                            <button
                                type="button"
                                className={theme.buttonSecondary}
                                {...triggerProps}
                                disabled={busy}
                                onClick={toggle}>
                                <IconComponent name="actions" size={14} />
                                <span>{text.actions}</span>
                            </button>
                        )} />
                ) : null}

                <span className={theme.toolbarSpacer} />

                <button type="button" className={theme.iconButton} aria-label={text.refresh} onClick={() => refresh()}>
                    <IconComponent name="refresh" size={16} />
                </button>

                {hasFilter ? (
                    <button
                        type="button"
                        className={theme.iconButton}
                        aria-label={text.filters}
                        aria-expanded={filtersOpen ? 'true' : 'false'}
                        aria-controls={filtersId}
                        onClick={() => setFiltersOpen((open) => ! open)}>
                        <IconComponent name="filter" size={16} />
                    </button>
                ) : null}
            </div>
        )
    }

    return (
        <section className={joinClasses(theme.datatable, cardWrapper && theme.surface)}>
            {renderBar()}

            {showTopbar && hasFilter ? (
                <div id={filtersId} className={joinClasses('filter-form', theme.datatableFilters)} hidden={! filtersOpen}>
                    {filterForm}
                </div>
            ) : null}

            <DataTableComponent
                table={table}
                head={visibleHead}
                rows={rows}
                clones={clones}
                loading={loading}
                error={error}
                actions={hasActions}
                selectable={selectable}
                showTableHeader={showTableHeader}
                dataTableComponents={dataTableComponents}
                labels={text}
                orderBy={orderBy}
                sort={sort}
                itemsFor={rowItems}
                prepareRow={preparePolicies}
                onSortColumn={sortColumn}
                onRetry={refresh} />

            {/* Con un error y sin filas, un «No hay resultados» en el pie
                contradiría el motivo que ya da la tabla. */}
            {error && rows.length === 0 ? null : (
                <SelectPaginationComponent meta={meta} labels={text} onPageChange={updatePage} />
            )}
        </section>
    )
}
