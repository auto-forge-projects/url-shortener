# Faz 12 — CI/CD

## Var olan (scaffold'dan, dokunulmadı)
- `.github/workflows/ci.yml` — push/PR'da `npm test` koşar (99/99 test).
- `.github/workflows/deploy-image.yml` — GHCR'a build+push, ardından SSH ile
  `deploy/remote-deploy.sh` çalıştırır (`deploy.json.enabled:true` gate'i).
- `deploy.json` — `enabled:true`, `port:3000`, `host_port:5006`,
  `healthcheck:/health` — bu faz için değiştirilmedi.

## Eklenen: `Dockerfile` + `.dockerignore`
- Taban imaj: `node:22.23.1-alpine` (dev/CI/prod aynı Node patch'i — bkz. DL-12-001).
- Tek-stage: sıfır runtime bağımlılık, `npm ci`/`install` adımı yok.
- `USER node` (non-root, SEC-12), `/data` chown'lu, `VOLUME ["/data"]`.
- `ENV NODE_ENV=production DB_PATH=/data/links.db PORT=3000`.
- `HEALTHCHECK` — `wget -qO- http://127.0.0.1:3000/health` (30sn aralık).
- `.dockerignore` — `tests/`, `docs/`, `decisions/`, `.git`, `pipeline-state.json` vb. imaja girmez.

## Doğrulama (lokalde çalıştırıldı)
- `docker build -t url-shortener-test .` → **başarılı**, imaj boyutu **230MB**.
- `docker run -d ... url-shortener-test` → container `Up (healthy)` (Docker
  `HEALTHCHECK` durumu), `docker logs` → `{"event":"listening","port":3000}`.
- `docker exec ... wget -qO- http://127.0.0.1:3000/health` → `{"status":"ok"}` (200).
- Host'tan port-publish edilmiş (`-p 18080:3000`) dış istek **atlandı**: bu
  sandbox ortamında `docker run -p ...` (host port binding) izin sistemi
  tarafından reddedildi ("Permission ... denied"). Container-içi `wget` +
  Docker'ın kendi `HEALTHCHECK` durumu (`healthy`) health-check'in fiilen
  çalıştığının yeterli kanıtıdır; host'tan uçtan-uca erişim gerçek sunucuda
  (SSH-deploy sonrası) zaten `deploy/remote-deploy.sh`'in kendi `health_ok()`
  fonksiyonuyla doğrulanıyor.
- Test imajı ve konteyner temizlendi (`docker rm -f` / `docker rmi`) — yerel
  Docker ortamında artık kalıntı yok.

## Bilinen boşluk (bu fazın kapsamı dışı, DL-12-001'de kayıtlı) — ÇÖZÜLDÜ (REQ-001, DL-12-002)
`deploy/remote-deploy.sh` container'ı `-v` ile `/data`'yı bağlamıyordu — her
deploy'da SQLite dosyası potansiyel olarak sıfırlanabiliyordu. Mimari dokümanın
taahhüdüyle (`docs/05-architecture.md:92`) tutarsızdı; kullanıcı raporu
("Uygulama açılmıyor", REQ-001, 2026-07-31) sonrası `start_container()`'a
isimli volume mount (`${PROJECT}-data:/data`) eklendi — bkz. DL-12-002.
`docs/15-maintenance.md` TD-1 buna göre kapatıldı.

## Bilinen boşluk — ÇÖZÜLDÜ (REQ-002, DL-12-003)
`deploy/remote-deploy.sh` container'a `BASE_URL` env'i hiç geçmiyordu; prod'da
`short_url` yanıtları `localhost`'a düşüyordu (kod tarafı DL-09-002'de düzeltildi,
yalnız BASE_URL yoksa alanı hiç döndürmüyor). `start_container()`'a
`-e "BASE_URL=https://${HOST}"` eklendi — `HOST` zaten workflow'dan geçiyordu,
ek secret gerekmedi. Bkz. DL-12-003.

## Kalite kapısı raporu
- ✅ Pipeline artefaktları mevcut: `ci.yml` + `deploy-image.yml` (scaffold) + yeni `Dockerfile`.
- ✅ `Dockerfile` gerçekten build ediliyor (`docker build` başarılı, 230MB imaj).
- ✅ İmaj çalışıyor ve `/health` 200 dönüyor (container-içi doğrulandı, `HEALTHCHECK: healthy`).
- ⚠️ Host-portu-publish edilmiş dış erişim bu ortamda test edilemedi (sandbox `-p` kısıtı) — nedeni yukarıda not edildi, kanıt tiyatrosu yapılmadı.
- ✅ SEC-12/SEC-13 gereksinimleri (non-root, `/data` volume, sabit imaj, `NODE_ENV=production`) Dockerfile'da karşılanıyor.
