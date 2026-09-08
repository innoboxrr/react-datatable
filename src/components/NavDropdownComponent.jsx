import { useCallback, useEffect, useRef } from 'react'
import { autoUpdate, computePosition, flip, offset as offsetMiddleware, shift } from '@floating-ui/dom'
import { classFor } from 'innoboxrr-form-core'

/**
 * Gemelo de NavDropdownComponent.vue.
 *
 * Antes lo movía `uk-dropdown`, y como UIkit sólo procesa el atributo al
 * montarse el nodo, había que avisarle con `UIkit.update()` — con guarda,
 * porque UIkit lo aportaba la aplicación anfitriona sin que nadie lo
 * declarara, y en una prueba no estaba.
 *
 * La mitad de lo que hacía ya lo hace el navegador. La **Popover API** —el
 * atributo `popover` y el `popoverTarget` del botón— aporta de fábrica la capa
 * superior, el cierre al pulsar fuera y el cierre con Escape. Lo único que
 * falta es colocarlo, y de eso se ocupa Floating UI.
 *
 * El botón que lo abre sólo necesita `popoverTarget` con este mismo id:
 *
 *     <button popoverTarget={`dropdown_${row.id}`}>…</button>
 *     <NavDropdownComponent id={`dropdown_${row.id}`} pos="left" />
 *
 * @param {{ id: string, pos?: string, offset?: number, children?: any }} props
 */
export default function NavDropdownComponent({
    id,
    // Se conservan los nombres que usaba UIkit para no romper a quien ya los
    // pasa; `bottom-left` y compañía se traducen a los de Floating UI.
    pos = 'bottom-left',
    offset = 4,
    children,
}) {
    const panel = useRef(null)
    const stopFollowing = useRef(null)

    const placement = (() => {
        const [side, align] = pos.split('-')

        if (! align) {
            return side
        }

        // UIkit dice `bottom-left` para «debajo, alineado a la izquierda»;
        // Floating UI lo llama `bottom-start`.
        return `${side}-${align === 'left' ? 'start' : 'end'}`
    })()

    const onBeforeToggle = useCallback((event) => {
        if (event.newState !== 'open') {
            stopFollowing.current?.()
            stopFollowing.current = null

            return
        }

        // El botón es quien apunta a este panel, así que se encuentra por el
        // atributo y no hace falta que nadie lo pase como prop.
        const trigger = document.querySelector(`[popovertarget="${id}"]`)

        if (! trigger || ! panel.current) {
            return
        }

        // autoUpdate recoloca al hacer scroll o redimensionar: un menú abierto
        // que se queda flotando donde estaba es peor que uno mal colocado.
        stopFollowing.current = autoUpdate(trigger, panel.current, () => {
            computePosition(trigger, panel.current, {
                placement,
                middleware: [
                    offsetMiddleware(offset),
                    // Si no cabe abajo, se va arriba; si se sale por un lado,
                    // se desplaza para caber.
                    flip(),
                    shift({ padding: 8 }),
                ],
            }).then(({ x, y }) => {
                Object.assign(panel.current.style, { left: `${x}px`, top: `${y}px` })
            })
        })
    }, [id, offset, placement])

    useEffect(() => {
        const node = panel.current

        node?.addEventListener('beforetoggle', onBeforeToggle)

        return () => {
            node?.removeEventListener('beforetoggle', onBeforeToggle)
            stopFollowing.current?.()
        }
    }, [onBeforeToggle])

    return (
        <div ref={panel} id={id} popover="" className={classFor('menu')}>
            <ul className="fe-menu-list">{children}</ul>
        </div>
    )
}
