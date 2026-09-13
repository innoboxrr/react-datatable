import { useSyncExternalStore } from 'react'
import { getTheme, onThemeChange } from 'innoboxrr-form-core'

/**
 * El tema de innoboxrr-form-core.
 *
 * Va por `useSyncExternalStore` porque el tema es estado de módulo: un
 * `setTheme` con la tabla ya montada tiene que repintarla.
 *
 * @returns {Record<string, string>}
 */
export default function useTheme() {
    return useSyncExternalStore(onThemeChange, () => getTheme(), () => getTheme())
}

/** Une clases descartando las vacías. */
export const joinClasses = (...classes) => classes.filter(Boolean).join(' ')
