# Cosmos ToDo — Frontend para GitHub Pages

Este mini-frontend consume tus Azure Functions existentes (`tasks-list`, `tasks-create`, `tasks-update`, `tasks-delete`) **sin cambiar los endpoints** para que tus comandos `curl` sigan funcionando igual.

## Archivos

- `index.html` — Página principal (SPA).
- `styles.css` — Estilos.
- `config.js` — Configuración (rellena tu `BASE_URL`, `FN_KEY` si aplica y `DEFAULT_USER_ID`).
- `app.js` — Lógica de la UI.
- `README.md` — Este archivo.

## Uso
1. Edita `config.js` y pon tu `BASE_URL`, ejemplo:
   ```js
   window.CosmosTodoConfig = {
     BASE_URL: "https://infratodo-xxxxx.azurewebsites.net",
     FN_KEY: "",                 // si tus funciones requieren ?code=
     DEFAULT_USER_ID: "carlos"
   };
   ```
2. Sube esta carpeta a un repo de GitHub y activa GitHub Pages (branch `main`, carpeta `/root`).
3. Abre tu URL de GitHub Pages y prueba.

## Endpoints esperados
- **List**: `GET /api/tasks-list?userId={userId}&code={fnKey}`
- **Create**: `POST /api/tasks-create?code={fnKey}` body: `{ "title": "...", "userId": "..." }`
- **Update**: `PUT /api/tasks-update?id={id}&code={fnKey}` body: `{ "title"?: "...", "isDone"?: true/false, "userId": "..." }`
- **Delete**: `DELETE /api/tasks-delete?id={id}&code={fnKey}`

Si tus rutas o métodos difieren (por ejemplo `PATCH`), solo ajusta las llamadas en `app.js`.

## CORS
Agrega tu dominio de GitHub Pages a CORS de tu Function App (sin cambiar endpoints ni tus `curl`). Opciones:
- **Portal Azure** → Function App → *CORS* → `https://<tu-usuario>.github.io`
- **CLI**:
  ```bash
  az functionapp config cors add     --resource-group <RG>     --name <APP_NAME>     --allowed-origins https://<tu-usuario>.github.io
  ```
> Si usas una subpágina (repo con nombre distinto), agrega también `https://<tu-usuario>.github.io/<repo>`.

## Seguridad (nota breve)
Si pones `?code=` en el frontend público, cualquiera con la URL puede verlo. Considera:
- Cambiar `authLevel` a `Anonymous` solo para lo estrictamente necesario, o
- Exponer las funciones detrás de API Management con OAuth, o
- Generar una *function key* secundaria de rotación y revocarla cuando sea necesario.

## Mantener `curl`
Nada cambia. Ejemplos (idénticos a tu flujo actual):
```bash
# List
curl -i "<BASE>/api/tasks-list?userId=carlos&code=<KEY>"

# Create
curl -i -X POST "<BASE>/api/tasks-create?code=<KEY>"   -H "Content-Type: application/json"   -d "{"title":"Probar desde curl","userId":"carlos"}"

# Update
curl -i -X PUT "<BASE>/api/tasks-update?id=<ID>&code=<KEY>"   -H "Content-Type: application/json"   -d "{"isDone":true,"userId":"carlos"}"

# Delete
curl -i -X DELETE "<BASE>/api/tasks-delete?id=<ID>&code=<KEY>"
```
