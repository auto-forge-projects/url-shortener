# url-shortener v0.2.0 — Release Notes

- Tarih: 2026-07-31 | SemVer: **v0.2.0** (0.x = API garanti yok) | Mod: AUTOPILOT
> Sürüm, Faz 8 planındaki M1 milestone'u ile tutarlı (tek milestone, tüm FR'ler kapsandı).

## v0.2.0 — Değişiklik (↺ REQ-003, 2026-07-31)
- **Kullanıcı talebi:** "bu uygulamayla alakalı sadece sağlık ucu var. uygulamayı kullanabileceğim link yok. uygulamanın köküne uygulamayı kullanabileceğim bir web sayfası hazırlar mısın." — ürünün ilk kullanıcı-arayüzü eksikliği.
- **Yeni özellik (FR-4):** `GET /` artık bir HTML form sunar (URL girilir, `Kısalt` tıklanır, mevcut `POST /api/shorten` (FR-1) çağrılır, sonuç/hata sayfada gösterilir); `GET /app.js` istemci scriptini sunar. **Minor bump** (yeni özellik, geriye dönük uyumsuzluk yok — mevcut API/redirect sözleşmesi değişmedi).
- **Güvenlik (Faz 7 REQ-003 delta, DL-07-003):** yeni 5 gereksinim (SEC-17..21) — XSS-güvenli DOM yazımı (`textContent` yalnız), route'a özgü CSP, istemci-içi sabit hata mesajı eşlemesi (SEC-19), statik route sertleştirmesi, çerez/CORS yasağı. RA-1..RA-3 risk kabulleri değişmedi.
- **Kapsam:** FR-1/2/3 ve NFR'ler değişmedi; yeni route'lar mevcut redirect/rate-limit bütçelerini tüketmez (DL-05-004).
- **Test:** `tests/static-page-handler.test.js` (yeni, 5 test) + route sırası regresyon testleri — toplam 110/110 yeşil (DL-11-002).

## v0.1.2 — Değişiklik (↺ REQ-002, 2026-07-31)
- **Kullanıcı talebi:** "https://url-shortener.apps.sametemek.com üzerinden erişim sağlayamıyorum" — kök neden `BASE_URL` prod'da hiçbir yerde set edilmediği için dönen `short_url`'ün her zaman `http://localhost:3000/<code>` olması (dışarıdan erişilemez).
- **Düzeltme (iki parça):** (1) `src/create-handler.js`/`src/server.js`: `BASE_URL` yoksa yanıt yalnız `{ code }` döner, `short_url` hiç eklenmez — DL-06-001 sözleşmesi artık gerçekten uygulanıyor (DL-09-002). (2) `deploy/remote-deploy.sh`: `start_container()` artık `-e "BASE_URL=https://${HOST}"` geçiyor, prod'da gerçek çalışan `short_url` üretilir (DL-12-003).
- **Kapsam:** FR-1/2/3 ve NFR'ler değişmedi; `GET /:code` yönlendirmesi zaten `BASE_URL`'den bağımsızdı, dokunulmadı.
- **Test:** `create-handler.test.js`'e 1 regresyon testi eklendi (BASE_URL yoksa code-only) — 100/100 yeşil.

## v0.1.1 — Değişiklik (↺ REQ-001, 2026-07-31)
- **Kullanıcı talebi:** "Uygulama açılmıyor" — kök neden `deploy/remote-deploy.sh`'in `/data`'yı kalıcı bir Docker volume ile bağlamaması (DL-12-001'de zaten kayıtlı P1 teknik borç, TD-1).
- **Düzeltme:** `start_container()` artık `-v "${PROJECT}-data:/data"` ile başlıyor (DL-12-002) — container her deploy'da yeniden yaratılsa da SQLite dosyası kalıcı kalır.
- **Kapsam:** Yalnız deploy script'i değişti; `src/` (FR-1/2/3, NFR-1..4) DEĞİŞMEDİ.
- **Bilinen sınır:** Bu düzeltmeden ÖNCEKİ deploy'larda oluşmuş veri kaybı geri getirilemez — yalnız BUNDAN SONRAKİ deploy'lar arasında kalıcılık garantilenir.

## Öne çıkanlar
İlk sürüm: anonim, hesapsız URL kısaltma servisi. Sıfır çalışma-zamanı bağımlılığı (yalnız `node:http` + `node:sqlite` + `node:crypto`).

## Özellikler
- **FR-1** `POST /api/shorten` — geçerli http(s) URL için benzersiz 7 haneli base62 kod üretir (≤200ms p95), çakışmada ≤3 retry.
- **FR-2** `GET /:code` — kayıtlı kod → 302 orijinal adrese; bilinmeyen kod → 404.
- **FR-3** Geçersiz şema/sözdizimi/kontrol karakteri/2048 karakter üstü girdi → 400, hiçbir kayıt oluşturulmaz.
- **FR-4** (v0.2.0) `GET /` — form ile web arayüzünden kısaltma; `GET /app.js` — istemci scripti.
- `GET /health` — servis durumu (deploy health-check + Docker `HEALTHCHECK` bunu kullanır).

## Güvenlik (docs/07-security.md)
- SEC-1: log/header injection savunması (kontrol karakteri reddi, IP hash'lenerek loglanır — ham IP diske yazılmaz).
- SEC-2/SEC-14: URL doğrulama ağ/DNS çağrısı yapmaz; IP-literal hedefler (loopback/link-local/bulut metadata/özel aralık) reddedilir (derinlemesine savunma — DNS rebinding kapsam dışı, bkz. bilinen sınırlar).
- SEC-6: SQL enjeksiyonuna karşı yalnız parametreli sorgu.
- SEC-7: kod üretimi CSPRNG + rejection sampling (modulo bias yok).
- Rate limiting (createHandler) + güvenlik başlıkları tüm yanıtlarda.
- Risk kabulleri RA-1/RA-2/RA-3: DL-07-002'de kayıtlı, insan onayı bekliyor (`pending_human_review`).

## Bilinen sınırlar (docs/15-maintenance.md'ye taşınacak)
- DNS rebinding savunması yok (yalnız literal IP reddi) — teknik borç.
- ~~`deploy/remote-deploy.sh` `/data` volume mount etmiyor~~ — **ÇÖZÜLDÜ v0.1.1'de** (DL-12-002, ↺ REQ-001).
- Gerçek çok-process race-condition testi yapılmadı (`node:sqlite` DatabaseSync tek-process senkron — DL-09-001/DL-11-001).
- Analitik, özel kod seçimi, son kullanma tarihi kapsam dışı (Faz 0 checkpoint kararı — v1 dışı).

## Kurulum
```
docker build -t url-shortener .
docker run -d -p 3000:3000 -v url-shortener-data:/data url-shortener
curl http://localhost:3000/health
```
Ortam: `PORT` (varsayılan 3000), `DB_PATH` (varsayılan `/data/links.db`).

## Rollback planı (kalite kapısı)
1. **Kod:** Önceki imaj tag'i (`ghcr.io/auto-forge-projects/url-shortener:<önceki-sha>`) ile `docker run` — `deploy-image.yml` her push'ta hem `latest` hem kısa-SHA tag'i ürettiğinden önceki SHA'ya anında dönülebilir.
2. **Veri uyumluluğu:** Şema tek tablo (`links(code, url, created_at)`), v0.1.0'dan geriye downgrade veri kaybı YARATMAZ — DDL idempotent, sürümler arası şema değişikliği henüz yok.
3. **Doğrulama:** Rollback sonrası `GET /health` → `{"status":"ok"}` ve bilinen bir kod ile `GET /:code` → 302 doğrulanır.
4. **Dağıtım:** `deploy/remote-deploy.sh` önceki tag ile yeniden çalıştırılır (SSH-push mekanizması, host_port/nginx bloğu değişmez).

## Kalite kapısı raporu
- "Rollback prosedürü tanımlı" → ✅ (4 adım: kod/veri/doğrulama/dağıtım)
- "Sürüm plana uygun" → ✅ (v0.1.0, Faz 8 M1 milestone ile tutarlı — tüm FR-1..3 kapsandı)
