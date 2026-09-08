import { useSyncExternalStore } from 'react'
import { Icon } from '@iconify/react'
import { iconFor, onIconChange } from 'innoboxrr-form-core'

/**
 * El icono de una accion de la tabla.
 *
 * Antes cada componente pintaba `<span class="uk-icon" uk-icon="icon: fa-plus">`
 * por su cuenta. Para que ese icono apareciera hacian falta tres dependencias
 * que ningun package.json declaraba: uikit, fontawesome y uikit-custom-icons,
 * que hacia de puente entre las dos.
 *
 * Ahora el nombre se resuelve contra el mapa de innoboxrr-form-core, el mismo
 * que usa la rama Vue.
 *
 * @param {{ icon: string, ratio?: number }} props
 */
export default function DatatableIcon({ icon, ratio = 1 }) {
    // useSyncExternalStore es la forma correcta de leer estado que vive fuera
    // de React: un `setIcons()` en caliente repinta lo ya montado.
    const resolved = useSyncExternalStore(
        onIconChange,
        () => iconFor(icon),
        () => iconFor(icon)
    )

    // `ratio` era el multiplicador de UIkit sobre 16px. Se conserva para no
    // romper a quien ya lo pasa.
    const size = ratio * 16

    return (
        <Icon
            className="fe-mr-sm"
            icon={resolved}
            width={size}
            height={size}
            aria-hidden="true" />
    )
}
