# 11 — Test Planı: url-shortener

- Tarih: 2026-07-27 | Mod: AUTOPILOT | Profil: LITE
- Kaynak: `docs/03-requirements.md` (FR-1..3, NFR-1..4), `docs/08-plan.md` (TASK-001..009)

## Kritik senaryolar (FR/NFR'den türetilmiş)

| # | Senaryo | Kaynak AC | Tür |
|---|---------|-----------|-----|
| S1 | Geçerli http(s) URL → 201 + benzersiz 7 haneli kod + `short_url`, ≤200ms | FR-1 AC1, NFR-1 | E2E |
| S2 | Aynı URL iki kez gönderilir → her ikisi de ayrı, çakışmayan kod alır ve her ikisi de bağımsız kalıcı kayıt olarak yönlendirir | FR-1 AC2 | E2E |
| S3 | Kayıtlı kısa kod → 302 ile orijinal URL'e %100 doğru yönlendirme | FR-2 AC1, NFR-3 | E2E |
| S4 | Kayıtsız/bilinmeyen kısa kod → 404 | FR-2 AC2 | E2E + birim |
| S5 | http/https dışı şema (`javascript:`, `data:`, `file:`, `ftp:`, `blob:`, `mailto:`) veya sözdizimi geçersiz girdi → kayıt öncesi 4xx red, hiçbir eşleme oluşmaz | FR-3 AC1, NFR-2 | E2E + birim |
| S6 | Kod çakışmasında ≤3 retry ile kurtarma; tükenirse hata | FR-1 (NFR-4 derinlemesine savunma, DL-09-001) | Birim |
| S7 | Eşzamanlı 200 kısaltma isteği → sıfır kod çakışması | NFR-4 | E2E (yük) |
| S8 | 30 ardışık kısaltma isteğinin p95 gecikmesi ≤200ms | NFR-1 | E2E (performans) |
| S9 | Bozuk JSON / eksik Content-Type / 4KB üstü gövde → 4xx, hiçbir kayıt oluşmaz (500 değil) | FR-3 (dolaylı — güvenilirlik) | E2E + birim |
| S10 | Kısa kod path'i `^/[0-9A-Za-z]{7}$` dışına düşerse (path traversal denemeleri dahil) → 404 | FR-2 AC2, SEC-9 | Birim |
| S11 | Depoda saklanan URL yönlendirme öncesi yeniden doğrulanır; tahrif edilmiş kayıt varsayımsal olarak geçersiz şema taşırsa 302 değil 404 döner | FR-2, SEC-3 | Birim |
| S12 | Güvenlik reddi uçları: SSRF amaçlı IP-literal (loopback/link-local/private/cloud-metadata) host'lar reddedilir; genel public IP/host kabul edilir (aşırı-geniş yasaklama yok) | NFR-2, SEC-14 | Birim |
| S13 | Rate limit aşımı → 429 + `Retry-After` (shorten ve redirect uçlarının ikisinde de) | Dolaylı (kötüye kullanım savunması, DL-09-001 kapsamına giren destek modülü) | Birim + E2E |
| S14 | Sıfır çalışma-zamanı bağımlılığı + tehlikeli dinamik API yok (`eval`, `child_process`, `vm`) + dış ağ/DNS çağrısı yok | NFR (mimari kısıt, DL-04-001/DL-09-001) | Statik/birim (kaynak taraması) |
| S15 | SQL enjeksiyon payload'ları kod olarak yalnız inert literal string muamelesi görür (parametreli sorgu) | NFR-4 bütünlüğü, SEC-6 | Birim |
| S16 | DDL idempotent; dosya-tabanlı store yeniden açıldığında önceki veriler kalıcıdır | FR-1 AC2 ("kalıcı depoda saklanır") | Birim |

## Kapsam dışı (bilinçli) — bkz. DL-11-001
- Gerçek çoklu-process/çoklu-worker eşzamanlılık testi (node:sqlite `DatabaseSync` senkron ve tek-process'te çalışıyor; gerçek race yalnız gelecekte çoklu worker/process eklenirse anlamlı olur).
- DNS rebinding savunması (DL-09-001'de belgelenmiş sınır — Faz 15 teknik borcu).
- Tarayıcı/gerçek istemci uyumluluğu (manuel/exploratory test dışı bırakıldı — LITE profili, tek geliştirici).
- Yük/performans testi tek-instance sequential p95 ile sınırlı; gerçek prod-ölçek yük testi (ör. k6, çoklu bağlantı havuzu) kapsam dışı.

## Kalite kapısı
- "Kritik senaryolar %100" → S1–S16 tamamı otomatik testle kapanıyor (bkz. `results.md`).
