# Revisión — procedimiento de publicación del Worker `joga-motion-api` (11-sep-2026)

Revisor: Nico. Modo: solo lectura. No se tocó Cloudflare, no se creó ningún token, no se ejecutó `wrangler deploy`, el repo quedó limpio (`git status` vacío antes y después).

## Veredicto: CAMBIOS (en el procedimiento, no en el código)

El procedimiento «pegar en el editor del panel» no es reproducible para José y hoy volvió a fallar. Hay que (A) corregir cómo se pega y se activa, con una comprobación visible en el panel, y (B) sustituirlo por `npx wrangler deploy` desde el Mac, que es viable y conserva los secretos.

---

## Estado medido (no afirmado)

- Huella del Worker vivo, 11-sep 21:10 UTC, `POST /compose` multipart sin fotos:
  `{"error":"one reference photo required"}` HTTP 400. Es la versión vieja.
- Con `POST /compose` en JSON (`{}`) responde `{"error":"multipart form required"}`. Ojo: la huella válida es **multipart** (`curl -F 'prompt=x'`), no JSON; con JSON las dos versiones responden igual y la huella no discrimina.
- El texto `one reference photo required` existe solo en `worker.js` entre los commits `7a0e97a` (10-sep 16:39) y `d7cb443` (11-sep 12:21). Las cinco sondas de `.joga/handoff/sonda-*.js` solo responden en `/diag` y no contienen ese texto. Conclusión: lo desplegado es el `worker.js` de `7a0e97a`, el que sí entró ayer; ninguna pegada de hoy (ni de `d7cb443` ni de `4d3e519`) está activa.
- Repo `joga-motion`: `worker.js` en HEAD `79c50a3` tiene 209 líneas, `nano-banana` en la línea 14, y la huella nueva `one to eight reference photos required` en la línea 90. Es un módulo ES (`export default {` en la línea 73). No hay `wrangler.toml`, ni `.gitignore`, ni `package.json`.
- Mac de José: `node` v24.20.0, `npx` 11.19.0, `which wrangler` → no existe. `npx --yes wrangler --version` (corrido desde el scratchpad, fuera del repo) descargó y arrancó: **4.131.1**. No pidió token ni creó archivos en el repo.

---

## Parte A — Por qué la pegada no activa

### A1. Qué hace «Deploy» y qué hace la flecha «Save»

Documentación (Gradual deployments, sección «Via the dashboard»):

> To save changes without deploying, select the **down arrow** next to **Deploy** > **Save**. This will create a new version of your Worker.

Y la definición (Versions & deployments):

> A version captures the complete state of your Worker at a point in time: its bundled code, static assets, bindings, and compatibility settings.
> A deployment determines which version(s) of your Worker are actively serving traffic.
> You can decouple them so that uploading a version and deploying it are independent actions.

Es decir: en el editor hay **dos botones pegados**: el grande «Deploy» (crea versión **y** la activa) y la flechita a su derecha con «Save» (crea versión y **no** la activa). Una versión guardada con «Save» queda en la lista pero el tráfico sigue en la anterior. **Sí es posible que José esté guardando una versión sin activarla**, y desde el editor no se nota: el código pegado sigue en pantalla, no hay error, y Cmd+F encuentra `nano-banana`.

Cómo se ve en el selector de versión: la etiqueta `(Active)` va con la versión que sirve tráfico; `Latest` con la más reciente creada. Si tras pegar aparece una versión nueva marcada `Latest` pero `(Active)` sigue en el hash de ayer, se guardó sin desplegar. (La doc no describe literalmente ese selector; la regla que sí documenta es que solo la versión en el «Active deployment» sirve tráfico.)

### A2. Retardo de propagación

No hay retardo documentado para un despliegue de código. La doc solo documenta retardos para Cron Triggers («up to 15 minutes») y para DNS de un subdominio nuevo (30–60 s), ninguno aplica aquí. Las horas que llevan pasando hoy **no son propagación**: si el despliegue hubiera ocurrido, la huella ya sería la nueva.

### A3. Editor de varios archivos

La doc no describe el explorador de archivos del editor del panel; no puedo citar una regla. Lo que sí es verificable y explica el patrón «pegué y no entró»:

- Cmd+A / Cmd+V solo actúan sobre el **cuadro de código que tiene el foco**. Si el último clic fue en el árbol de archivos, en la pestaña de vista previa o en la barra superior, Cmd+A selecciona la página y Cmd+V no cambia nada; «Deploy» entonces **sí despliega, pero el mismo código de antes** (aparece una versión nueva idéntica). Esto es exactamente lo que ayer arregló el «Cmd+F antes de Deploy».
- Si el árbol muestra más de un archivo (por ejemplo `worker.js` e `index.js`), pegar en el que no es el punto de entrada deja el viejo sirviendo. Se detecta porque el `(Active)` cambia pero la huella no.

### A4. Pestaña «Deployments» y cómo activar una versión guardada

Doc (Versions & deployments y Deployment management):

> In the Cloudflare dashboard, go to the **Workers & Pages** page. Select your Worker > **Deployments**.
> Select **Promote deployment** and choose the version you want to deploy.

Doc de rollback (Rollbacks):

> Select the three dot icon on the right of the version you would like to roll back to and select **Rollback**.

Esa pestaña es la **única pantalla que dice la verdad**: lista las versiones con hora, origen (Dashboard / Wrangler / API) y cuál está en el «Active deployment». Es donde José debe mirar para saber si su clic creó algo y si está activo.

### A5. Causa más probable, ordenada

1. **Se creó versión sin desplegar** («Save» de la flecha en vez de «Deploy»): explica «pegué y di Deploy» dos veces sin cambio, y también los 3–4 intentos de ayer. Se confirma si en «Deployments» hay versiones de hoy y el «Active» es de ayer.
2. **La pegada no cayó en el editor** (foco fuera del cuadro de código) y «Deploy» desplegó código idéntico. Se confirma si en «Deployments» hay despliegues de hoy marcados Active pero la huella no cambia.
3. Pegado en un archivo que no es el punto de entrada (solo si el árbol tiene más de un archivo).

Descartado: propagación (A2) y sondas (`/diag`) enmascarando la huella.

### A6. Pasos exactos para José (español sencillo, con lo que debe ver)

Antes: en el Finder, abrir `Downloads/JOGA INTELLIGENCE/joga-motion/worker.js` con TextEdit. Cmd+A, Cmd+C. Debe ver todo el texto sombreado en azul antes de copiar. Cerrar TextEdit sin guardar cambios.

1. Entrar a dash.cloudflare.com → **Workers & Pages** → clic en **joga-motion-api**.
   Debe ver: el nombre `joga-motion-api` arriba y la dirección `joga-motion-api.omhotien90.workers.dev`.
2. Clic en la pestaña **Deployments** (antes de tocar nada).
   Debe ver: una lista de versiones con fecha y hora. Anotar (o foto) cuál dice **Active**. Si hay filas de hoy que no son la Active, ya sabemos que hoy se guardó sin desplegar.
3. Arriba a la derecha, clic en **Edit code**.
   Debe ver: el editor con el código a la derecha y, a la izquierda, el árbol con el archivo. Si hay más de un archivo, clic en `worker.js` (o en el único archivo `.js` que haya) para que se abra en la pestaña.
4. Clic **dentro** del código, en cualquier línea (no en el árbol, no en la barra). Cmd+A.
   Debe ver: **todo** el código sombreado, de la primera a la última línea.
5. Cmd+V.
   Debe ver: el texto cambia; la primera línea dice `// JOGA MOTION — Cloudflare Worker`.
6. Cmd+F, escribir `nano-banana`, Enter.
   Debe ver: se resalta la línea 14 (`const FAL_IMAGE_MODEL = 'fal-ai/nano-banana/edit';`). Si no aparece, la pegada no entró: volver al paso 4. Cerrar el buscador con Esc.
7. Clic en el botón **azul grande que dice «Deploy»**. NO en la flechita pequeña a su derecha (esa abre «Save», que guarda sin publicar). Si aparece una ventanita de confirmación, volver a clic en **Deploy**.
   Debe ver: un aviso verde de que se desplegó (algo como «Version deployed» / «Successfully deployed»).
8. Comprobación 1: en el selector de versión del editor, la versión nueva debe llevar **(Active)**. Si (Active) sigue en el hash de ayer y la nueva solo dice «Latest», se guardó sin desplegar → ir al paso 9.
9. Comprobación 2 (y remedio): volver a la pestaña **Deployments**. La fila de arriba, con la hora de ahora, debe decir **Active**. Si no: clic en los **tres puntos** de esa fila → **Promote deployment** / **Deploy** → confirmar. Ahora sí debe decir Active.
10. Comprobación final por Nico/Kimo: `curl -s -X POST -F 'prompt=x' https://joga-motion-api.omhotien90.workers.dev/compose` debe responder `{"error":"one to eight reference photos required"}`. Mientras responda `one reference photo required`, no está activo.

Si tras el paso 9 el Active es de hoy pero la huella sigue vieja: la pegada cayó en otro archivo (A3, punto 3). Avisar y lo vemos con el árbol de archivos.

---

## Parte B — Publicar sin pegar: `npx wrangler deploy` desde el Mac

### B1. Viabilidad

Viable. Node v24.20.0 presente; `npx --yes wrangler --version` descargó wrangler **4.131.1** y arrancó sin instalar nada global ni tocar el repo. No hace falta Homebrew ni `npm install -g`.

### B2. Qué hace falta

**(a) Autenticación — dos opciones, la primera es la más sencilla para José:**

- **Opción 1, `npx wrangler login`** (OAuth por navegador). Doc: «Authorize Wrangler with your Cloudflare account using OAuth. Wrangler will attempt to automatically open your web browser to login with your Cloudflare account.» José abre el navegador, clic en «Allow», listo. La credencial queda en la carpeta de wrangler del usuario (`~/.wrangler/`), fuera del repo. No hay que copiar ningún token a mano. Se verifica con `npx wrangler whoami`.
- **Opción 2, API Token.** Doc (Create API token): «go to **My Profile** > **API Tokens**», «Select **Create Token**», elegir plantilla. La plantilla recomendada por la doc de CI/CD es **«Edit Cloudflare Workers»** (doc GitHub Actions: es la política que recomiendan para `wrangler deploy`). Al crearla, en «Account Resources» dejar solo la cuenta de José. El token se guarda **fuera del repo** en un archivo con permisos 600, por ejemplo `~/.config/joga/cloudflare.env` con la línea `CLOUDFLARE_API_TOKEN=...`, y se carga en el shell justo antes del comando; **nunca** se imprime, nunca se pega en el chat ni en un archivo del repo. Doc: «Don't store the value of `CLOUDFLARE_API_TOKEN` in your repository, as it gives access to deploy Workers on your account.» Variables que wrangler lee (doc System environment variables): `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.

**(b) `account_id`.** Doc (Find account and zone IDs): en **Workers & Pages**, sección **Account Details**, botón de copiar junto a **Account ID**. No es secreto, pero tampoco hace falta ponerlo en el repo: con `wrangler login` y una sola cuenta, wrangler lo resuelve solo; si hay duda, va como `CLOUDFLARE_ACCOUNT_ID` en el mismo archivo 600.

**(c) `wrangler.toml` mínimo en el repo** (doc Configuration: `name`, `main`, `compatibility_date` son las tres claves base):

```toml
name = "joga-motion-api"
main = "worker.js"
compatibility_date = "AAAA-MM-DD"   # copiar la que muestra el panel en Settings del Worker
keep_vars = true
```

- `compatibility_date`: debe ser **la misma** que ya tiene el Worker en el panel (Workers & Pages → joga-motion-api → Settings). Una fecha distinta cambia el runtime; no se inventa.
- `keep_vars = true`: doc Configuration: «If you change your environment variables in the Cloudflare dashboard, Wrangler will override them the next time you deploy. If you want to disable this behavior, add `keep_vars = true` to your Wrangler configuration file.» Protege cualquier variable **no secreta** que exista en el panel.
- Wrangler crea una carpeta `.wrangler/` local al correr; hay que añadir `.wrangler/` a un `.gitignore` (hoy el repo no tiene ninguno). Eso lo hace Tavo, no yo.

### B3. CRÍTICO — ¿`wrangler deploy` conserva los secretos?

**Sí, los conserva.** Dos citas:

- Doc Wrangler commands (`deploy`, flag `--keep-vars`): **«Secrets are never deleted by a deployment whether this flag is true or false.»**
- Doc Wrangler configuration: **«Wrangler will not delete your secrets (encrypted environment variables) unless you run `wrangler secret delete <key>`.»**

`HF_API_KEY_ID`, `HF_API_KEY_SECRET` y `FAL_KEY` siguen en su sitio tras `npx wrangler deploy`. Confirmación medible: el Worker vivo hoy respondió 400 con validación de formulario y no `FAL_KEY missing in Worker secrets` (502), que es lo que el código nuevo devolvería si faltara `FAL_KEY`; ese mismo chequeo sirve tras el primer deploy por wrangler.

**Variables de entorno en claro** (no secretas): esas **sí** las sobreescribe wrangler salvo `keep_vars = true` (cita en B2c). Por eso va en el toml. Rutas/dominios personalizados: el Worker vive en `*.workers.dev`, sin rutas en el toml; nada que pisar.

Además, desde el changelog 2025-11-21 (wrangler deploy remote config management): `wrangler deploy` muestra la diferencia entre la configuración local y la del panel y pide confirmación antes de pisar algo; si solo añade, sigue sin preguntar. Es una red extra.

### B4. Comandos exactos, en orden, la primera vez

Todo lo corre **José en su Terminal**, o Kimo/Tavo con José delante; yo no. Desde la carpeta del repo:

```bash
cd "/Users/joseogallardo/Downloads/JOGA INTELLIGENCE/joga-motion"
npx wrangler login              # abre el navegador; José da «Allow»
npx wrangler whoami             # debe mostrar el correo de José y la cuenta
npx wrangler deploy --dry-run   # doc: «Compile a project without actually deploying to live servers»
npx wrangler deploy             # publica worker.js y lo activa al 100%
```

Con token en vez de login, la línea del deploy sería:
`set -a; source ~/.config/joga/cloudflare.env; set +a; npx wrangler deploy` (mismo shell, sin `echo`, sin pegar el token).

Doc Versions & deployments: «when you run wrangler deploy, Workers creates a new version and immediately deploys it to 100% of traffic in a single step.» Wrangler imprime al final la URL y un «Current Version ID»; ese hash debe aparecer como Active en la pestaña Deployments.

### B5. Comprobación tras el primer deploy por wrangler

1. `curl -s -X POST -F 'prompt=x' https://joga-motion-api.omhotien90.workers.dev/compose` → `{"error":"one to eight reference photos required"}`.
2. Que **no** responda `FAL_KEY missing in Worker secrets` (eso probaría que un secreto se perdió; la doc dice que no pasa).
3. En el panel, Deployments: fila nueva con origen **Wrangler**, marcada Active.

### B6. Vuelta atrás si algo sale mal

- Panel (doc Rollbacks): Workers & Pages → joga-motion-api → **Deployments** → tres puntos de la versión anterior → **Rollback**. «A rollback will immediately create a new deployment with the specified version of your Worker and become the active deployment.» Límite documentado: «You can only roll back to the 100 most recently published versions.» «Resources connected to your Worker will not be changed during a rollback» (los secretos se quedan como están).
- Terminal: `npx wrangler rollback`.

### B7. Riesgos y límites de esta evaluación

- No abrí el panel de José (no es mío y no debo tocar Cloudflare); las descripciones de pantalla en A6 salen de la doc y del selector que Kimo describió (`<hash> (Active) Latest`). Si un botón se llama distinto, la pestaña **Deployments** y la huella `/compose` siguen siendo la prueba.
- No verifiqué la plantilla «Edit Cloudflare Workers» permiso por permiso en la pantalla de creación (requiere sesión de José). La doc la nombra como la recomendada para `wrangler deploy`.
- `wrangler login` guarda un token OAuth en `~/.wrangler/`; es el mismo nivel de acceso que un token, pero sin que nadie lo copie a mano. Se revoca desde My Profile → API Tokens cuando se quiera.

---

## Fuentes (doc oficial)

- Versions & deployments: https://developers.cloudflare.com/workers/configuration/versions-and-deployments/
- Gradual deployments (botón Deploy vs flecha Save; Promote deployment): https://developers.cloudflare.com/workers/configuration/versions-and-deployments/gradual-deployments/
- Deployment management: https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/
- Rollbacks: https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/
- Wrangler commands — Workers (`deploy`, `--keep-vars`, «Secrets are never deleted by a deployment», `versions upload`, `versions deploy`, `rollback`, `--dry-run`): https://developers.cloudflare.com/workers/wrangler/commands/workers/
- Wrangler commands — General (`login`, `whoami`): https://developers.cloudflare.com/workers/wrangler/commands/general
- Wrangler configuration (`name`, `main`, `compatibility_date`, `keep_vars`, «Wrangler will not delete your secrets»): https://developers.cloudflare.com/workers/wrangler/configuration/
- Secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- System environment variables (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`): https://developers.cloudflare.com/workers/wrangler/system-environment-variables/
- Create API token: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
- GitHub Actions (plantilla «Edit Cloudflare Workers», no guardar el token en el repo): https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- Find account and zone IDs: https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/
- Changelog: wrangler deploy muestra diferencias con el panel antes de pisar: https://developers.cloudflare.com/changelog/2025-11-21-wrangler-deploy-remote-config-management/
- Cron Triggers (único retardo de propagación documentado, no aplica): https://developers.cloudflare.com/workers/configuration/cron-triggers/

---

## Lecciones de esta vuelta

1. **Una publicación no está hecha hasta que la huella lo diga.** «Pegué y di Deploy» es una afirmación; la huella `POST /compose` multipart es la medición. Regla: después de cada Deploy, alguien corre la huella antes de dar nada por publicado.
2. **La huella debe estar bien especificada.** Con JSON, las dos versiones responden igual (`multipart form required`) y la sonda no discrimina. Regla: documentar el comando exacto de la huella (`curl -F`), no solo el endpoint.
3. **El botón grande y la flechita hacen cosas distintas.** Un procedimiento para alguien no técnico tiene que decir «el azul grande, no la flechita» y qué debe ver después. Regla: cada paso manual lleva su «debe ver».
4. **Pegar sondas en el Worker de producción multiplica las pegadas.** Cinco sondas en dos días, cada una seguida de «volver a pegar worker.js», es el procedimiento frágil corrido diez veces. Regla: las sondas van a un Worker aparte (`joga-motion-sonda`) o se corren con wrangler `--dry-run`/local; producción no se usa de banco de pruebas.
5. **Cuando el mismo paso manual falla dos días seguidos, el arreglo es quitar el paso, no repetirlo mejor.** Regla: si un procedimiento a mano se repite más de dos veces, se automatiza (aquí: `npx wrangler deploy`).
6. **Antes de recomendar una herramienta, confirmar que arranca en la máquina real.** `npx wrangler --version` desde fuera del repo, `git status` después. Costó 30 segundos y evita prometer algo que no corre.
7. Lo que no pude medir (la pantalla del panel de José) lo dejé marcado como no medido (B7), no como verificado.
