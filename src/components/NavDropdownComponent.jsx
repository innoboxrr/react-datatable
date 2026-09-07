import { useEffect, useRef } from 'react'

/**
 * Gemelo de NavDropdownComponent.vue.
 *
 * UIkit lee el atributo `uk-dropdown` del DOM. React lo escribe igual, pero
 * UIkit sólo lo procesa al montarse el nodo, así que se le avisa — con guarda,
 * porque UIkit lo aporta la aplicación anfitriona y en una prueba no está.
 */
export default function NavDropdownComponent({
    id,
    pos = 'bottom-left',
    mode = 'click',
    offset = 0,
    animation = 'uk-animation-slide-top-small',
    duration = 500,
    children,
}) {
    const host = useRef(null)

    useEffect(() => {
        globalThis.UIkit?.update?.(host.current)
    }, [])

    return (
        <div
            ref={host}
            id={id}
            uk-dropdown={`pos: ${pos}; mode: ${mode}; offset: ${offset}; animation: ${animation}; duration: ${duration};`}
            className="uk-padding-remove z-10 hidden text-base list-none bg-white divide-y divide-gray-100 rounded-lg shadow w-44 dark:bg-slate-800 p-2">
            <ul className="uk-nav uk-dropdown-nav">{children}</ul>
        </div>
    )
}
