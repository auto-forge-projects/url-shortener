# 00 — Yeni İhtiyaç (REQ-003)

- Tarih: 2026-07-31 | Cycle: 4 | Talep sahibi bildirimi: sametemek@windowslive.com

## Talep (birebir)

> bu uygulamayla alakalı sadece sağlık ucu var. uygulamayı kullanabileceğim link yok. uygulamanın köküne uygulamayı kullanabileceğim bir web sayfası hazırlar mısın.

## Sınıflandırma

**feature** — yeni kullanıcı-görünür davranış. Bugüne kadar `url-shortener` saf bir API'ydi (`POST /api/shorten`, `GET /:code`, `GET /health`); `docs/06-uiux/README.md` bunu açıkça "Erişilebilirlik: N/A (arayüz yok, saf HTTP sözleşmesi)" olarak kayda geçirmişti. Kullanıcı artık tarayıcıdan doğrudan kullanabileceği bir sayfa istiyor — bu yeni bir FR'dir, hata düzeltmesi değildir.

## Etki analizi

- **Hedef faz: 3 (Requirement Analizi)** — yeni FR: "Web arayüzünden URL kısaltma". Mimari kısıt getirmiyor (yeni veri modeli/bileşen yok — mevcut `LinkService`/`router.js` üzerine ince bir statik/HTML katmanı); bu yüzden hedef 5 değil 3.
- **Downstream etkiler (AF-091 `invalidPhases` ile otomatik geçersiz sayılacak, sırayla yeniden doğrulanacak):**
  - Faz 5 (Mimari): "Erişilebilirlik: N/A" notunun düzeltilmesi + yeni route'un component view'a eklenmesi (küçük ekleme, yeni bileşen değil).
  - Faz 6 (UI/UX): yüzey sözleşmesine `GET /` eklenir, ilk gerçek "arayüz" akışı tanımlanır.
  - Faz 9 (Development): `router.js`'e `GET /` route'u + statik HTML sayfası (formdan `POST /api/shorten`'a çağrı) — TDD (red→green).
  - Faz 10 (Code Review): diff'in blind re-review'u (pazarlıksız).
  - Faz 11 (Test): yeni route için entegrasyon senaryosu.
  - Faz 12 (CI/CD): Dockerfile/statik dosya kopyalama etkisi kontrol edilecek (muhtemelen değişiklik gerekmez — tek dosya `src/` altında inline string/HTML olacak).
  - Faz 13 (Release): **minor** version bump (v0.1.2 → v0.2.0) — yeni kullanıcı-görünür özellik.
  - Faz 14 (Monitoring): yeni route için 5xx/latency izlemesi mevcut genel HTTP izlemesine dahil, ek risk maddesi değerlendirilecek.
  - Faz 15 (Bakım): teknik borç listesi gözden geçirilecek.
  - Faz 16 (Retro): delta özeti eklenecek.

## Varsayım (kural 8 — AUTOPILOT, onay beklenmedi)

Kullanıcı "web sayfası" derken, mevcut API'nin üzerine ince bir sunucu-taraflı statik HTML/JS eklenmesini kastediyor (SPA/framework değil) — LITE profilin "artefakt bütçesi" ve mevcut sıfır-bağımlılık mimarisiyle (bkz. `docs/04-solution-analysis.md`) tutarlı en basit çözüm budur. Sayfa: URL girme formu → `POST /api/shorten` çağırır → sonucu (kısa link) gösterir.
