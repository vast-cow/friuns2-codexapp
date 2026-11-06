# Local development

First start `codex app-server --listen ws://127.0.0.1:4500` independently, using the
same user, `CODEX_HOME`, and workspace paths. See [connection details](external-app-server.md).
Development honors `CODEXUI_APP_SERVER_URL`; `dev2` now preserves `CODEX_HOME`.

Install dependencies with `pnpm install`. Normal HTTP development needs no TLS
credentials:

```sh
pnpm run dev --host 127.0.0.1 --port 4173
```

Production builds use `pnpm run build` and do not read development certificates.

## Optional HTTPS

Generate a fresh key and certificate on each developer machine. Previously
published private keys, including the old `.cert/localhost-key.pem`, are
compromised and must never be reused. This cleanup does not remove them from Git
history. Remove old local copies before generating replacements.

With OpenSSL installed, run from the repository root in a POSIX shell:

```sh
mkdir -p .cert
chmod 700 .cert
(umask 077; openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 30 \
  -keyout .cert/localhost-key.pem -out .cert/localhost-cert.pem \
  -subj '/CN=localhost' \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1')
pnpm run dev --config vite.config.https.ts --port 4173
```

Open `https://127.0.0.1:4173`. This self-signed certificate is not automatically
trusted by browsers. For trusted local HTTPS, use your existing local CA tool
(such as mkcert) to generate the same two files. Protect private keys with
owner-only permissions (or equivalent Windows ACLs); never share them or commit
them. No certificate tool is required at application runtime.

Alternatively, point to an existing local certificate and matching private key
outside the repository. Set **both** environment variables in the shell before
starting Vite (these are server-only variables, without a `VITE_` prefix):

```sh
DEV_HTTPS_KEY_PATH=/absolute/path/local-key.pem \
DEV_HTTPS_CERT_PATH=/absolute/path/local-cert.pem \
  pnpm run dev --config vite.config.https.ts --port 4173
```

PowerShell users can set `$env:DEV_HTTPS_KEY_PATH` and
`$env:DEV_HTTPS_CERT_PATH` before running the same dev command. Relative paths
resolve from the working directory. Missing or unreadable credentials fail with
setup instructions; HTTPS never silently falls back to HTTP. Restart Vite after
rotating certificates. HTTPS binds to loopback by default; remote development
requires an explicit `--host` and a certificate covering that hostname.

`.cert/` and common certificate/key file extensions are ignored by Git. Keep
custom credentials outside the repository even when using another extension;
never force-add ignored credentials. Delete `.cert/` when local HTTPS is no
longer needed, and unset the two environment variables after testing.
