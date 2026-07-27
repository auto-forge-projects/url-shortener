# 03 — Requirement Analizi: url-shortener

- Tarih: 2026-07-27 | Mod: AUTOPILOT | Profil: LITE

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

## Kalite kapısı raporu
- "Her FR'nin kabul kriteri var" → ✅ (FR-1..3, her biri Given/When/Then)
- "NFR'ler ölçülebilir" → ✅ (NFR-1..4, sayısal/ikili ölçüt)
