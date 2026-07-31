# 00 — Yeni İhtiyaç (↺ REQ-002): url-shortener

- Tarih: 2026-07-31 | Cycle: 3 | Mod: AUTOPILOT (mevcut `default_mode` korunur)
- Bildirim e-postası: sametemek@windowslive.com

## Talep (birebir)
> "Uygulama adresi olan https://url-shortener.apps.sametemek.com üzerinden erişim sağlayamıyorum."

## Sınıflandırma
- **Tür:** patch (davranış hatası — mevcut FR/mimari sözleşme değişmiyor, uygulama kendi dokümante edilmiş kararına aykırı davranıyor)
- **Hedef faz:** 9 (Development — `src/server.js` + `src/create-handler.js`)
- **Gerekçe:** kök neden kod okumasıyla DOĞRUDAN doğrulandı (canlı prob gerekmedi — statik kanıt yeterli, aşağıya bak).

## Kök neden (kod-kanıtlı, VARSAYIM DEĞİL)
- `src/server.js:83`: `const baseUrl = process.env.BASE_URL || \`http://localhost:${port}\`;` — production'da `BASE_URL` env'i **hiçbir yerde** set edilmiyor (Dockerfile, `deploy.json`, `deploy/remote-deploy.sh`, `.github/workflows/deploy-image.yml` içinde `BASE_URL` geçmiyor — `grep -rn BASE_URL` tüm repoda yalnız doküman + bu satırı buluyor).
- `src/create-handler.js`: `sendJson(res, 201, { code, short_url: \`${baseUrl}/${code}\` })` — döndürülen HER `short_url` bu `baseUrl`'i kullanıyor.
- Sonuç: production'da POST `/api/shorten` çağıran her kullanıcıya `short_url: "http://localhost:3000/<code>"` dönüyor — dışarıdan **tamamen erişilemez**. Kullanıcı bu linki kopyalayıp kullandığında (veya ana adresin bir "kısaltma" arayüzü sunduğunu varsayıp yanıttaki adresi ziyaret ettiğinde) "https://url-shortener.apps.sametemek.com üzerinden erişemiyorum" algısı doğar.
- **Ayrıca kendi kararına aykırı:** `docs/06-uiux/README.md:44` (DL-06-001) açıkça "BASE_URL yoksa yalnız `code` döner" diye karar bağlanmıştı — kod bunu hiç implemente etmedi, bunun yerine sessizce `localhost` fallback'i icat etti. Bu, Faz 6→9 arası kayıp bir sözleşme (contract drift).
- **Test kanıtı:** `tests/*.test.js` içindeki HER test `createServer`/`createHandler`'ı açık bir `baseUrl` vererek çağırıyor (`grep -rn baseUrl tests/`) — gerçek prod yolu (`BASE_URL` env yokken `require.main===module` fallback'i) hiç test edilmemiş. Bu yüzden mevcut `npm test` yeşili bu bugı yakalamadı.

## Kapsam
- **İÇİNDE (Faz 9):** `src/server.js` + `src/create-handler.js` — `BASE_URL` env yoksa DL-06-001'in dediğini yap: yanıt yalnız `{ code }` döner (`short_url` alanı hiç eklenmez), yeni bir regresyon testi (`BASE_URL` verilmeden `createServer` çağrılınca prod yolunun code-only döndüğünü doğrular).
- **İÇİNDE (Faz 12, downstream — aynı deltanın tamamlayıcı yarısı):** `deploy/remote-deploy.sh:start_container()` `docker run`'a `-e "BASE_URL=https://${HOST}"` ekle — böylece production'da gerçek domain ile ÇALIŞAN tam `short_url` üretilir (yalnız "hata vermeme" değil, doğru davranış).
- **DIŞINDA:** FR-1/2/3 ve NFR'ler değişmiyor; yönlendirme (`GET /:code`) davranışı zaten `BASE_URL`'den bağımsız, dokunulmuyor.

## Etkilenen fazlar (AF-091 türetilmiş geçersizlik)
- **9 (hedef):** kod fix + yeni test + DL-09-002.
- **12:** `remote-deploy.sh` env fix + DL-12-003.
- **13:** patch sürüm artışı (v0.1.1 → v0.1.2) + release notes.
- **14:** monitoring notuna "BASE_URL prod'da doğrulanıyor" eklenir.
- **15:** yeni TD açılmaz (kapanan bug), gerekirse "test kör noktası" notu.
- **16:** içerik etkilenmiyor, yeniden onay.
- Faz 10: LITE'ta zaten atlanıyor (`profiles.LITE.skipped`); Faz 11: yalnız yeni/regresyon senaryosu eklenir, sıfırdan plan yok.
