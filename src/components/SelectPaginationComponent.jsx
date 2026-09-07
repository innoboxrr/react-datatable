/**
 * Gemelo de SelectPaginationComponent.vue.
 *
 * La página vive en el padre (el hook), así que aquí no hay estado local: la
 * versión Vue lo tenía y se le desincronizaba cuando la página cambiaba desde
 * fuera, por ejemplo al reiniciar los filtros.
 */
export default function SelectPaginationComponent({ meta = {}, onPageChange }) {
    const current = meta.current_page ?? 1
    const last = meta.last_page ?? 1

    return (
        <div className="pagination" fe-grid="">
            <div className="fe-w-auto">
                <ul className="fe-pagination fe-justify-start fe-mt-md" fe-mb="">
                    <li>
                        {meta.total > 0
                            ? <span>Showing {meta.from} to {meta.to} of {meta.total} entries</span>
                            : <span>No results found</span>}
                    </li>
                </ul>
            </div>

            <div className="fe-w-expand">
                <ul className="fe-pagination fe-justify-end fe-mt-md" fe-mb="">
                    {current > 1 ? (
                        <li>
                            <a
                                href="#"
                                aria-label="Anterior"
                                onClick={(event) => {
                                    event.preventDefault()
                                    onPageChange?.(current - 1)
                                }}>
                                <span fe-page-prev=""></span>
                            </a>
                        </li>
                    ) : null}

                    <li>
                        <select
                            aria-label="Página"
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                            value={current}
                            onChange={(event) => onPageChange?.(Number(event.target.value))}>
                            {Array.from({ length: last }, (_, index) => index + 1).map((page) => (
                                <option key={`page_${page}`} value={page}>{page}</option>
                            ))}
                        </select>
                    </li>

                    {current < last ? (
                        <li>
                            <a
                                href="#"
                                aria-label="Siguiente"
                                onClick={(event) => {
                                    event.preventDefault()
                                    onPageChange?.(current + 1)
                                }}>
                                <span fe-page-next=""></span>
                            </a>
                        </li>
                    ) : null}
                </ul>
            </div>
        </div>
    )
}
