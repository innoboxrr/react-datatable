# innoboxrr-react-datatable

Gemelo React de [`innoboxrr-vue-datatable`](../vue-datatable). Los mismos props,
el mismo contrato de modelo.

El contrato vive en `resources/<framework>/src/models/<entity>/index.js`, que
es **el mismo archivo** para Vue y para React: funciones puras y llamadas HTTP,
sin nada de un framework de UI. Por eso las dos tablas reciben lo mismo.

## Instalación

```
npm i innoboxrr-react-datatable
```

## Uso

```jsx
import DataTable, { registerRoutes } from 'innoboxrr-react-datatable'
import * as postModel from './models/post'

registerRoutes({
    AdminCreatePost: '/admin/posts/create',
    AdminEditPost: '/admin/posts/:id/edit',
    AdminShowPost: '/admin/posts/:id',
})

<DataTable
    dataUrl={route('api.acme.blog.post.index')}
    policyUrl={route('api.acme.blog.post.policies')}
    model={postModel}
    filterForm={<FilterForm onSubmit={setFilters} />} />
```

## Equivalencias con la versión Vue

| Vue | React |
|---|---|
| `<slot name="filterForm">` | prop `filterForm` (React no tiene slots con nombre) |
| `@sortColumn`, `@actionClicked`… | props `onSortColumn`, `onActionClicked`… |
| `defineExpose({ crudActions, dataTable, pagination })` | el hook `useDataTable`, exportado |
| rutas con nombre de vue-router | `registerRoutes()` (ver abajo) |
| `uk-toggle` sobre el formulario de filtros | estado del componente |

Todo lo demás —`dataUrl`, `dataMethod`, `model`, `policyUrl`, `policyMethod`,
`showTopbar`, `hasActions`, `hasFilter`, `formFilters`, `externalFilters`,
`extraParams`, `extraQuery`, `hideColumns`, `cardWrapper`, `showTableHeader`—
se llama y significa lo mismo.

## Rutas con nombre

El contrato del modelo apunta a rutas **por nombre**:

```js
params: { to: { name: 'AdminEditPost', params: { id: 1 } } }
```

vue-router resuelve eso de fábrica; React Router 7 no tiene rutas con nombre.
`registerRoutes({ nombre: patrón })` cierra ese hueco, y el módulo generado lo
llama al montarse. Una ruta sin registrar **lanza**: devolver `#` escondería el
fallo hasta que alguien hiciera clic.

## `useDataTable`

Toda la lógica —cargar, ordenar, paginar, resolver políticas— está en el hook,
fuera del componente. Se puede probar sin montar nada y sirve para pintar la
misma tabla de otra forma:

```jsx
const { dataTable, pagination, sortColumn, updatePage } = useDataTable({ ... })
```

## Diferencias deliberadas

- **El clon de cada fila se hace una vez por repintado**, no en una caché de
  módulo. La versión Vue guarda los clones en un `WeakMap` global, así que un
  `parser` que escriba en su fila envenena esa copia para el resto de la vida
  de la página, y dos tablas que compartan objetos de fila comparten clones.
- **La paginación no tiene estado propio.** En Vue lo tenía y se le
  desincronizaba cuando la página cambiaba desde fuera, por ejemplo al
  reiniciar los filtros.
- **`ActionListComponent` es uno solo.** En Vue el bloque de acciones está
  copiado en `DataTable.vue` y en `DataTableComponent.vue`, y las dos copias no
  hacen lo mismo: la de dentro soporta `action.link` y la de fuera no.

## Pruebas

```
npm test
```
