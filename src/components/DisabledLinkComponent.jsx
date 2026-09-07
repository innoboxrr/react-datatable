/**
 * Gemelo de DisabledLinkComponent.vue: la acción que el usuario no puede
 * ejecutar. Se sigue mostrando, deshabilitada, para que la interfaz no cambie
 * de forma según los permisos.
 */
export default function DisabledLinkComponent({ icon = '', text }) {
    const showIcon = icon !== '' && icon != null

    return (
        <a
            href="#"
            aria-disabled="true"
            className="disabled-link block px-4 py-2 dark:hover:text-white dark:text-slate-400"
            uk-tooltip="title: This action is not authorized; pos:right"
            onClick={(event) => event.preventDefault()}>
            {showIcon ? <span className="fe-mr-sm uk-icon" uk-icon={icon}></span> : null}
            <span>{text}</span>
        </a>
    )
}
