# 14 — Monitoring: url-shortener

- Tarih: 2026-07-27 | Mod: AUTOPILOT | Profil: LITE (asgari: health + hata görünürlüğü)
- Ürün tipi: `service` (API) → izlenecekler: health endpoint, latency (p95), error rate

## Health check
| Kontrol | Sağlıklı | Sorunlu davranış |
|---------|----------|-------------------|
| `GET /health` | 200 + sabit OK payload (bkz. `src/health-handler.js`, SEC-15: iç detay sızdırmaz) | Yanıt yok/5xx/timeout → container `HEALTHCHECK` başarısız, orchestrator (Docker/Swarm) restart eder |
| DB erişimi (`/data/links.db`) | Boot'ta dizin var + yazılabilir | Yazılamıyorsa süreç **hızlı başarısız** (mimari kararı, DL-05-003) — sessiz geçici diske düşmez, log'da net hata |

## Hata görünürlüğü / loglama
- `POST /api/shorten`: 400 (geçersiz URL — `UrlValidator` reddi), 500 (kod uzayı tükendi — 3 retry sonrası) `stderr`'a log'lanır (yol/kod, gövde/URL içeriği YOK — PII değil ama gereksiz veri de loglanmaz).
- `GET /:code`: 404 (kayıt yok) — bilgi düzeyinde, alert GEREKMEZ (beklenen kullanıcı hatası).
- Hassas veri loglanmaz: hedef URL'ler ham log satırına yazılmaz (yalnız kod + HTTP status + latency loglanır) — kullanıcı gizliliği/veri minimizasyonu.

## Kritik akış izleme (kalite kapısı)
- **Kritik risk 1 — NFR-1 (≤200ms p95):** her istek için `Router` seviyesinde latency ölçülüp loglanır (`method path status duration_ms`); p95 threshold aşımı tekil log satırından grep edilebilir (`awk`/log toplayıcı). LITE'ta ayrı bir metrik sunucusu yok — log tabanlı görünürlük yeterli kabul edildi.
- **Kritik risk 2 — DB kalıcılığı (Faz 5 açık risk) — ÇÖZÜLDÜ v0.1.1 (↺ REQ-001, DL-12-002):** `deploy/remote-deploy.sh` artık `/data`'yı isimli bir Docker volume'a (`${PROJECT}-data`) bağlıyor; restart/redeploy sonrası linkler kaybolmaz. Alert mekanizması yine yok (LITE) ama health check DB dosyasının varlığını dolaylı yakalamaya devam eder (yoksa hızlı-fail loglanır).
- **Error rate:** 5xx oranı log'dan (`status>=500` satır sayısı / toplam) hesaplanabilir; ayrı dashboard/alerting altyapısı bu ölçekte (LITE, solo) kurulmadı — bilinçli kapsam dışı.

## Kalite kapısı raporu
- "Kritik akışlar için alert/hata görünürlüğü tanımlı" → ✅ (health check + yapılandırılmış log satırı + DB kalıcılık riski açıkça izlenebilir kılındı; ayrı metrik/alert altyapısı LITE kapsamı dışı, DL'de gerekçelendirildi)
