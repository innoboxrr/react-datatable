# innoboxrr-react-datatable

Gemelo React de [`innoboxrr-vue-datatable`](../vue-datatable): los mismos
props, el mismo contrato de modelo y el mismo comportamiento —barra de
acciones, filtros, orden y paginación en el servidor, selección con acciones
masivas, permisos antes de abrir cada menú, esqueletos y errores que se ven—.

Por debajo, [TanStack Table](https://tanstack.com/table) lleva el estado de la
tabla y `innoboxrr-react-form-elements` pone el menú, los iconos y los
esqueletos, con el tema de `innoboxrr-form-core`.

## Instalación

```
npm i innoboxrr-react-datatable innoboxrr-form-core innoboxrr-react-form-elements react-router-dom
```

```js
import 'innoboxrr-form-core/styles'
```

## Uso

```jsx
import { useRef, useState } from 'react'
import DataTable, { registerRoutes } from 'innoboxrr-react-datatable'
import * as productModel from './models/product'

registerRoutes({
    AdminCreateProduct: '/admin/products/create',
    AdminEditProduct: '/admin/products/:id/edit',
})

export default function Products() {
    const table = useRef(null)
    const [filters, setFilters] = useState({})

    // Tras crear o editar en un drawer: table.current.refresh()

    return (
        <DataTable
            ref={table}
            dataUrl={route('api.acme.shop.product.index')}
            dataMethod="get"
            policyUrl={route('api.acme.shop.product.policies')}
            policyMethod="get"
            model={productModel}
            formFilters={filters}
            selectable
            filterForm={<FilterForm onSubmit={setFilters} />} />
    )
}
```

Los avisos y las confirmaciones necesitan, una vez en la aplicación,
`ToastRegionComponent` y `ConfirmHostComponent` de
`innoboxrr-react-form-elements`.

Los props, el contrato del modelo, `bulkActions`, los permisos y lo que se ve
mientras carga o cuando falla están descritos en el
[README de la versión Vue](../vue-datatable/README.md): son idénticos.

## Equivalencias con la versión Vue

| Vue | React |
|---|---|
| `<template #filterForm>` | prop `filterForm` |
| `ref` con `defineExpose` | `ref` (React 19): `refresh()`, `clearSelection()`, `selectedIds`, `table` |
| rutas con nombre de vue-router | `registerRoutes()` (abajo) |
| componente de celda con `@callback` | componente de celda con `onCallback` |

La lógica común —columnas, petición, errores, acciones— vive en
`src/table.js`, que es el mismo archivo en los dos paquetes.

## Rutas con nombre

El contrato apunta a rutas **por nombre** (`params.to.name`). React Router 7 no
las tiene, así que `registerRoutes({ nombre: patrón })` dice a qué patrón
corresponde cada una. Una acción hacia una ruta sin registrar avisa al usuario y
deja el detalle en la consola.

## `useDataTable`

```jsx
import { useDataTable } from 'innoboxrr-react-datatable'

const { table, rows, meta, loading, error, sortColumn, updatePage, refresh } = useDataTable({ ...props, navigate, labels })
```

## De 2.x a 3.0

- Ya no existen `ActionListComponent`, `DatatableIcon`, `NavDropdownComponent`,
  `IconRouteComponent`, `IconLinkComponent` ni `DisabledLinkComponent`.
- `DataTableComponent` recibe la instancia de TanStack Table en `table`;
  `SelectPaginationComponent` sigue recibiendo `meta` y `onPageChange`.
- Las acciones de ruta navegan desde el menú con `useNavigate`.
- Los textos están en español y se cambian con `labels`.
- Un fallo ya no se reintenta: se ve, y se reintenta a mano.
- `innoboxrr-react-form-elements` pasa a ser dependencia par, y
  `innoboxrr-form-core` sube a `^2.6`.

## Pruebas

```
npm test
```

## Documentación / Documentation

Documentación completa del ecosistema, en español y en inglés / Full ecosystem documentation, in Spanish and English: <https://innoboxrr.github.io/docs/interfaz/datatables>
