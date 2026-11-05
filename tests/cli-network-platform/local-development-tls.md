# Local development TLS credentials

## Feature/Change Name
Development HTTPS uses ignored local credentials or explicit paths; HTTP and
production builds require no credentials.

## Prerequisites/Setup
Install dependencies and OpenSSL. Use an unused localhost port and follow
[local HTTPS setup](../../docs/development.md). Never reuse the historical key.

## Steps
1. With no `.cert/`, run `pnpm run dev --host 127.0.0.1 --port 4173`.
   Request `http://127.0.0.1:4173/` and stop this test server.
2. Run `pnpm run dev --config vite.config.https.ts --port 4173` without keys.
3. Generate fresh credentials using the documented OpenSSL command. Repeat the
   HTTPS command and request `https://127.0.0.1:4173/` with curl using
   `--cacert .cert/localhost-cert.pem`. Stop this test server.
4. Move the credentials to a temporary directory outside the repository, set
   both documented path variables, and repeat step 3 using that CA file.
5. Set only one path variable and start HTTPS again.
6. Unset both variables. Run `pnpm run build` with no `.cert/`.
7. Run `git check-ignore .cert/localhost-key.pem .cert/localhost-cert.pem`.

## Expected Results
HTTP and HTTPS return the application. Missing files and incomplete path pairs
fail with actionable setup errors. The production build succeeds without keys.
Generated credentials are ignored and no credentials are tracked in `.cert/`.

## Rollback/Cleanup
Stop only test servers, delete generated credentials and temporary directories,
and unset the path variables. Never restore the previously published key.
