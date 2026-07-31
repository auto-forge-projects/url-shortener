# 11 — Test Sonuçları: url-shortener

- Tarih: 2026-07-27 | Mod: AUTOPILOT | Profil: LITE
- Komut: `npm test` (`node --test`) — workspace kökünde fiilen çalıştırıldı.

## Koşum özeti

| Ölçü | Değer |
|------|-------|
| Toplam test | 99 |
| Geçen | 99 |
| Kalan (fail) | 0 |
| İptal / atlanan / todo | 0 |
| Süre | ~7.3 sn |

```
# tests 99
# suites 0
# pass 99
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

**Not:** Faz 9 kapanışında 98 test vardı (98/98 geçiyordu). Faz 11 kapsamında FR-1 AC2'yi ("aynı URL iki kez gönderilirse her ikisi de çakışmayan/benzersiz kod ile kalıcı olarak saklanır") doğrudan doğrulayan 1 yeni entegrasyon testi eklendi (`tests/integration.test.js`) → toplam 99. Mevcut 98 test değiştirilmedi, yalnız eksik kritik senaryo tamamlandı.

## Dosya bazlı dağılım

| Test dosyası | Test sayısı | Kapsadığı bileşen (TASK) |
|---|---|---|
| url-validator.test.js | 16 | TASK-002 |
| create-handler.test.js | 8 | TASK-006 |
| body-reader.test.js | 8 | TASK-006 (destek) |
| link-service.test.js | 7 | TASK-005 |
| logger.test.js | 7 | TASK-006 (destek) |
| sqlite-link-store.test.js | 7 | TASK-004 |
| integration.test.js | 7 (yeni: 1) | TASK-009 |
| code-generator.test.js | 6 | TASK-003 |
| redirect-handler.test.js | 6 | TASK-007 |
| server.test.js | 6 | TASK-008 |
| link-store.test.js | 5 | TASK-001 (port sözleşmesi) |
| rate-limiter.test.js | 5 | TASK-006 (destek) |
| router.test.js | 5 | TASK-008 |
| security-invariants.test.js | 3 | TASK-008 (çapraz-kesim) |
| security-headers.test.js | 2 | TASK-006 (destek) |
| health-handler.test.js | 1 | TASK-008 |
| **Toplam** | **99** | |

## FR/NFR ↔ Test izlenebilirlik tablosu

| ID | Gereksinim (özet) | Kapsayan test(ler) | Durum |
|----|--------------------|--------------------|-------|
| FR-1 AC1 | Geçerli URL → ≤200ms benzersiz kod + short_url | `integration.test.js` ("full lifecycle"), `create-handler.test.js` ("valid URL -> 201"), `link-service.test.js` ("shorten() stores…", "NFR-1 smoke test") | ✅ |
| FR-1 AC2 | Aynı URL tekrar → çakışmayan kod, kalıcı ayrı kayıt | `integration.test.js` ("FR-1 AC2: submitting the same URL twice…", **yeni eklendi**) | ✅ |
| FR-2 AC1 | Kayıtlı kod → 302 doğru hedefe | `integration.test.js` ("full lifecycle"), `server.test.js` ("POST … then GET"), `redirect-handler.test.js` ("known code -> 302") | ✅ |
| FR-2 AC2 | Bilinmeyen kod → 404 | `integration.test.js` ("full lifecycle"), `redirect-handler.test.js` ("unknown code -> 404", "SEC-9 path"), `server.test.js` ("unknown route -> 404") | ✅ |
| FR-3 AC1 | Geçersiz şema/sözdizimi → kayıt öncesi 4xx, eşleme yok | `integration.test.js` ("NFR-2 + FR-3"), `url-validator.test.js` (16 test), `create-handler.test.js` ("invalid scheme -> 400", "rejected requests never write a row") | ✅ |
| NFR-1 | Kod üretimi ≤200ms (p95) | `integration.test.js` ("p95 shorten latency"), `link-service.test.js` ("NFR-1 smoke test") | ✅ |
| NFR-2 | Yalnız http/https kabulü, SSRF reddi | `url-validator.test.js` (şema + IP-literal denylist testleri), `integration.test.js` ("NFR-2 + FR-3") | ✅ |
| NFR-3 | Yönlendirme hedef eşleşmesi %100 | `integration.test.js` ("NFR-3: multiple concurrently-created links…") | ✅ |
| NFR-4 | Kısa kod çakışmama | `integration.test.js` ("NFR-4: 200 concurrently-created links…"), `link-service.test.js` (retry/collision testleri), `code-generator.test.js` ("100k generations") | ✅ |

Ek çapraz-kesim güvenlik/güvenilirlik testleri (SEC-1/3/4/5/6/7/8/9/10/11/13/14/15/16), `docs/07-security.md` ve DL-09-001'de belirtilen savunmaların doğrudan karşılığıdır ve yukarıdaki tabloya girmeyen destekleyici kanıt olarak `security-invariants.test.js`, `url-validator.test.js`, `sqlite-link-store.test.js`, `logger.test.js`, `rate-limiter.test.js`, `body-reader.test.js`, `security-headers.test.js` dosyalarında bulunur.

## Kalite kapısı raporu
- "Kritik senaryolar %100 geçti" → ✅ 99/99 test geçiyor; FR-1..3 ve NFR-1..4'ün her AC'si en az bir testle izlenebilir (yukarıdaki tablo).
- Eksik bulunan tek kritik senaryo (FR-1 AC2 — aynı URL'in iki kez kısaltılması) test eklenerek kapatıldı; implementasyon DEĞİŞTİRİLMEDİ (yalnız `tests/integration.test.js`'e 1 yeni test eklendi).
- Gate sonucu: **GEÇTİ**.

## REQ-002 delta yeniden doğrulama (2026-07-31, AF-091)
- `create-handler.test.js`'e 1 yeni regresyon testi eklendi: "no BASE_URL -> code only, no short_url" — toplam **100/100 geçiyor**.
- Bu, DL-09-002'nin kod fix'inin (BASE_URL yoksa `short_url` alanı hiç dönmez) doğrudan kanıtıdır; FR/NFR sözleşmesi değişmedi, sıfırdan test planı gerekmedi.
