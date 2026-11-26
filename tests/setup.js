import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

// jsdom 27+ oculta [popover] con su hoja de agente de usuario, pero todavia no
// implementa showPopover(). MenuComponent ve que la API no existe y cae a su
// respaldo (el atributo hidden), que es lo que haria un navegador sin popover;
// ahi el atributo popover no oculta nada. Se restituye ese comportamiento para
// que el respaldo se pruebe como en un navegador real. Va en <html> y se
// repone en cada prueba porque hay suites que reescriben document.head.
const popoverFallback = document.createElement('style')
popoverFallback.textContent = '[popover]:not([hidden]) { display: block; }'

beforeEach(() => {
    if (! popoverFallback.isConnected) {
        document.documentElement.appendChild(popoverFallback)
    }
})

afterEach(() => {
    cleanup()
})
