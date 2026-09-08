import DisabledLinkComponent from './DisabledLinkComponent.jsx'
import IconLinkComponent from './IconLinkComponent.jsx'
import IconRouteComponent from './IconRouteComponent.jsx'

// Un popover se cierra solo: no hace falta preguntarle nada a nadie.
// La llamada es opcional porque hidePopover no existe en un navegador anterior
// a la Popover API —ni en jsdom—, y un menu que no cierra es mejor que una
// excepcion.
const closeDropdown = (event) => {
    event.target.closest('[popover]')?.hidePopover?.()
}

/**
 * Las tres formas que puede tomar una acción del contrato del modelo, en un
 * solo sitio. En la versión Vue este bloque está copiado en `DataTable.vue` y
 * en `DataTableComponent.vue`, con una diferencia entre ambas copias — la de
 * dentro soporta `action.link` y la de fuera no.
 */
export default function ActionListComponent({ actions = [], extraParams = {}, extraQuery = {}, onActionClicked }) {
    return actions.map((action) => (
        <li key={action.id ?? action.name} className="hover:bg-slate-100 dark:hover:bg-slate-600 px-2 py-1">
            {(() => {
                if (! action.policy) {
                    return <DisabledLinkComponent icon={action.icon} text={action.name} />
                }

                if (action.route && ! action.link) {
                    return (
                        <IconRouteComponent
                            name={action.params.to.name}
                            params={{ ...action.params.to.params, ...extraParams }}
                            query={action.params.to.query ? { ...action.params.to.query, ...extraQuery } : { ...extraQuery }}
                            icon={action.icon}
                            text={action.name} />
                    )
                }

                if (action.route && action.link) {
                    return (
                        <IconLinkComponent
                            link={action.params.link}
                            target={action.params.target}
                            icon={action.icon}
                            text={action.name} />
                    )
                }

                return (
                    <IconLinkComponent
                        icon={action.icon}
                        text={action.name}
                        onClick={(event) => {
                            event.preventDefault()
                            onActionClicked?.(action)
                            closeDropdown(event)
                        }} />
                )
            })()}
        </li>
    ))
}
