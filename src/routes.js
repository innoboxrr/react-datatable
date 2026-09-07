/**
 * Rutas con nombre para React Router.
 *
 * El contrato del modelo (`models/<entity>/index.js`) es el mismo archivo para
 * Vue y para React, y en él las acciones apuntan a una ruta **por nombre**:
 *
 *     params: { to: { name: 'AdminEditPost', params: { id: 1 } } }
 *
 * vue-router resuelve eso de fábrica. React Router 7 no, así que el módulo
 * generado registra aquí su mapa nombre → patrón y este archivo hace la
 * sustitución. Sin esto, cada gemelo React tendría que reescribir las acciones
 * — y ahí es donde el contrato dejaría de ser uno.
 */

/** @type {Map<string, string>} */
const routes = new Map()

/**
 * @param {Record<string, string>} definitions  nombre → patrón, p. ej.
 *   `{ AdminEditPost: '/admin/posts/:id/edit' }`
 */
export function registerRoutes(definitions) {
    Object.entries(definitions).forEach(([name, pattern]) => routes.set(name, pattern))
}

export function hasRoute(name) {
    return routes.has(name)
}

export function resetRoutes() {
    routes.clear()
}

/**
 * @param {string} name
 * @param {Record<string, string|number>} params
 * @param {Record<string, string|number>} query
 * @returns {string}
 */
export function buildPath(name, params = {}, query = {}) {
    const pattern = routes.get(name)

    if (! pattern) {
        // Devolver '#' escondería el fallo hasta que alguien hiciera clic. La
        // ruta que falta es un error de registro, y se ve antes si grita.
        throw new Error(
            `[innoboxrr-react-datatable] La ruta '${name}' no está registrada. `
            + 'Llama a registerRoutes({ ' + name + ': \'/tu/patron/:id\' }) al montar el módulo.'
        )
    }

    const used = new Set()

    const path = pattern.replace(/:([A-Za-z0-9_]+)\??/g, (match, key) => {
        if (params[key] === undefined || params[key] === null) {
            if (match.endsWith('?')) {
                return ''
            }

            throw new Error(`[innoboxrr-react-datatable] Falta el parámetro '${key}' para la ruta '${name}'.`)
        }

        used.add(key)

        return encodeURIComponent(String(params[key]))
    }).replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'

    // Lo que no encaje en el patrón viaja como query, igual que en vue-router.
    const search = new URLSearchParams()

    Object.entries(params).forEach(([key, value]) => {
        if (! used.has(key) && value !== undefined && value !== null) {
            search.set(key, String(value))
        }
    })

    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            search.set(key, String(value))
        }
    })

    const queryString = search.toString()

    return queryString ? `${path}?${queryString}` : path
}
