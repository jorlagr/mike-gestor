# Balance — Mike Moya y Largueta

Aplicación web adaptable para registrar ingresos y gastos de dos empresas, alojada como sitio estático en GitHub Pages. La autenticación y los datos persistentes viven en Supabase; GitHub Pages no es un servidor ni una base de datos.

## Puesta en marcha

1. Crea un proyecto Supabase en su plan gratuito y abre **SQL Editor**.
2. Ejecuta el contenido de [`supabase/schema.sql`](./supabase/schema.sql). Crea tablas y políticas RLS; no crea movimientos ni ejemplos.
3. En **Authentication → Users**, crea tu usuario con contraseña. Desactiva los registros públicos en **Authentication → Settings**.
4. Copia el UUID de usuario y ejecuta en SQL Editor, sustituyendo `TU_UUID_DE_USUARIO` por el UUID real:

   ```sql
   insert into public.user_companies (user_id, company_id) values
     ('TU_UUID_DE_USUARIO', '00000000-0000-4000-8000-000000000001'),
     ('TU_UUID_DE_USUARIO', '00000000-0000-4000-8000-000000000002');
   ```

5. En GitHub, publica esta carpeta en un repositorio llamado `mike-gestor` y configura en **Settings → Secrets and variables → Actions** estos secretos del repositorio:
   - `VITE_SUPABASE_URL`: URL del proyecto Supabase.
   - `VITE_SUPABASE_ANON_KEY`: clave pública/anon del proyecto. **Nunca uses `service_role` en el navegador o GitHub Pages.**
6. En **Settings → Pages**, elige **GitHub Actions** como fuente. El workflow de este repo compila y publica al hacer push a `main`. El enlace será `https://USUARIO.github.io/mike-gestor/`.

No se requiere un plan de pago para el despliegue base. La disponibilidad, límites y retención del plan gratuito dependen de las condiciones vigentes de GitHub y Supabase.

## Desarrollo local

```sh
npm install
```

Copia `.env.example` a `.env.local`, pon la URL y la clave **anon** de Supabase y ejecuta:

```sh
npm run dev
npm test
npm run build
```

Usa Node.js 22. La app no guarda movimientos en el navegador. Si faltan las credenciales del backend, muestra una pantalla de configuración en vez de aparentar que los datos se han guardado.

## Privacidad, separación y copias

- Los movimientos se particionan por `company_id`; todas las consultas de la pantalla de empresa acotan por su ID y las operaciones de edición/borrado por movimiento y empresa. El historial puede ordenarse por fecha ascendente o descendente.
- Row Level Security impide el acceso salvo que el usuario autenticado esté vinculado a esa empresa en `user_companies`. Mantén desactivado el registro público y no compartas la clave `service_role`.
- La pantalla conjunta lee filas de ambas empresas para calcular sus totales por separado y el balance agregado; no las modifica ni altera sus contabilidades.
- No se incluye contabilidad ficticia. Las empresas empiezan vacías.
- Para una copia adicional independiente, exporta CSV o Excel periódicamente y guarda el archivo en un lugar privado. El plan gratuito de Supabase no debe tratarse como garantía de copias automáticas o recuperación; consulta sus condiciones actuales y configura copias externas si necesitas recuperación garantizada.

## Uso

Inicia sesión con el usuario privado creado en Supabase, elige Mike Moya o Largueta, y registra el tipo, concepto, fecha e importe. Los filtros de concepto/mes/año actualizan el resumen y las exportaciones incluyen solo los resultados visibles. Para usarlo en el móvil, abre el enlace de Pages en el navegador y añádelo a la pantalla de inicio si lo deseas.
