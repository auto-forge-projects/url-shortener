# 03 — Requirement Analizi: url-shortener

- Tarih: 2026-07-27 | Mod: AUTOPILOT | Profil: LITE
- **REQ-003 delta (2026-07-31):** FR-4 eklendi — kökte kullanılabilir bir web arayüzü (bkz. `docs/00-idea-v4.md`).

## Fonksiyonel gereksinimler

### FR-1: Kısa link oluşturma
- **User story:** Ziyaretçi olarak, uzun bir URL gönderdiğimde benzersiz kısa bir kod almak istiyorum, böylece linki kolayca paylaşabilirim.
- **Kabul kriterleri (zorunlu):**
  - Given geçerli bir http(s) URL, when kısaltma isteği gönderilir, then ≤200ms içinde benzersiz bir kısa kod ve tam kısa link döner.
  - Given aynı URL tekrar gönderilir, when kısaltma isteği yapılır, then çakışmayan/benzersiz bir kod ile eşleme kalıcı depoda saklanır.
- **Öncelik:** Must

### FR-2: Kısa linkten yönlendirme
- **User story:** Ziyaretçi olarak, kısa linke tıkladığımda orijinal adrese yönlendirilmek istiyorum, böylece hedef içeriğe ulaşırım.
- **Kabul kriterleri (zorunlu):**
  - Given kayıtlı bir kısa kod, when o linke istek gelir, then orijinal URL'e 3xx yönlendirme %100 doğrulukla yapılır.
  - Given kayıtsız/bilinmeyen bir kısa kod, when o linke istek gelir, then 404 (bulunamadı) döner.
- **Öncelik:** Must

### FR-3: Geçersiz URL girişini reddetme
- **User story:** Ziyaretçi olarak, bozuk/geçersiz bir URL gönderirsem anlaşılır bir hata almak istiyorum, böylece hatalı veri sisteme kaydedilmez.
- **Kabul kriterleri (zorunlu):**
  - Given şeması http/https olmayan veya sözdizimi geçersiz bir girdi, when kısaltma isteği yapılır, then istek kayıt öncesi reddedilir (4xx) ve hiçbir eşleme oluşturulmaz.
- **Öncelik:** Must

### FR-4: Web arayüzünden kısaltma (REQ-003)
- **User story:** Ziyaretçi olarak, uygulamanın kök adresine (`/`) tarayıcıdan girdiğimde bir form görmek ve URL kısaltabilmek istiyorum, böylece API'yi elle çağırmadan (curl/Postman) uygulamayı kullanabilirim.
- **Kabul kriterleri (zorunlu):**
  - Given kök yol (`GET /`), when tarayıcıdan istek gelir, then 200 döner ve bir URL girme formu içeren HTML sayfası gösterilir.
  - Given form üzerinden geçerli bir URL gönderilir, when kısaltma isteği yapılır (formun kendi `POST /api/shorten` çağrısı üzerinden, FR-1), then sonuç kısa link aynı sayfada, kopyalanabilir biçimde gösterilir.
  - Given form üzerinden geçersiz bir URL gönderilir, when istek reddedilir (FR-3), then sayfa hata mesajını (400 yanıtının `message` alanı) kullanıcıya gösterir, sayfa çökmez.
- **Öncelik:** Must (talep sahibinin doğrudan ifade ettiği tek eksik: "kullanabileceğim link yok")
- **Kapsam dışı (v1):** hesap/oturum, geçmiş link listesi, özel kod seçimi — mevcut FR-1..3 sözleşmesini genişletmez, yalnız var olan API'ye bir istemci ekler.

## Fonksiyonel olmayan gereksinimler (kalite kapısı: ölçülebilir)
| ID | Kategori | Gereksinim | Ölçüt / Hedef |
|----|----------|------------|----------------|
| NFR-1 | Performans | Kısa kod üretim süresi | ≤200ms (p95), otomatik testle ölçülür |
| NFR-2 | Güvenlik | Yalnız http/https şema kabulü (SSRF/`javascript:`/`file:` vb. reddi) | Doğrulama testinde %100 red |
| NFR-3 | Doğruluk | Yönlendirme hedef eşleşmesi | %100 (entegrasyon testi) |
| NFR-4 | Bütünlük | Kısa kod çakışmama | Üretilen kodlarda çakışma oranı 0 (benzersizlik testi) |

## İzlenebilirlik
| FR | Karşıladığı KPI / iş hedefi |
|----|------------------------------|
| FR-1 | KPI-1: ≤200ms içinde benzersiz kısa kod üretimi |
| FR-2 | KPI-2: Yönlendirme %100 doğruluk |
| FR-3 | KPI-3: Geçersiz URL %100 red |
| FR-4 | REQ-003: uygulamanın kullanılabilir bir erişim yüzeyi olması (talep sahibinin doğrudan ihtiyacı) |

## Kalite kapısı raporu
- "Her FR'nin kabul kriteri var" → ✅ (FR-1..4, her biri Given/When/Then)
- "NFR'ler ölçülebilir" → ✅ (NFR-1..4, sayısal/ikili ölçüt; FR-4 mevcut NFR'leri değiştirmiyor, yalnız mevcut API'nin önüne istemci ekliyor)
