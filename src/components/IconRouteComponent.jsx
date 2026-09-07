import { Link } from 'react-router-dom'
import { buildPath } from '../routes.js'

/**
 * Gemelo de IconRouteComponent.vue.
 *
 * vue-router resuelve `{ name, params, query }`; React Router 7 no tiene rutas
 * con nombre, así que la ruta se construye con el mapa que declare la
 * aplicación (ver `registerRoutes` en `src/routes.js`). El contrato del modelo
 * —`params.to.name`— no cambia, que es lo que importa: `models/<entity>/
 * index.js` es el mismo archivo para Vue y para React.
 */
export default function IconRouteComponent({
    name,
    params = {},
    query = {},
    text,
    icon,
    ratio = 1,
    textClass = '',
}) {
    return (
        <Link
            to={buildPath(name, params, query)}
            className="block px-4 py-2 dark:hover:text-white dark:text-slate-400">
            <span
                className="fe-mr-sm uk-icon"
                uk-icon={`icon: ${icon}; ratio: ${ratio};`}
                style={{ fontSize: `${ratio * 16}px` }}></span>
            <span className={textClass}>{text}</span>
        </Link>
    )
}
