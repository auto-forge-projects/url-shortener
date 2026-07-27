# 15 — Bakım: url-shortener

- Tarih: 2026-07-27 | Mod: AUTOPILOT
- Bu dosya ÜRÜNÜN teknik borcunu izler; fabrikanın eksikleri `AUTOFORGE-FEEDBACK.md`'ye.

## Bilinen sorunlar
- Host-portu-publish edilmiş dış erişim Faz 12'de sandbox kısıtı yüzünden test edilemedi (container-içi doğrulama + `HEALTHCHECK: healthy` yeterli kanıt kabul edildi; gerçek sunucuda `deploy/remote-deploy.sh` health probe'u ile doğrulanıyor).

## Teknik borç (kalite kapısı: önceliklendirilmiş)
| # | Borç | Kaynak (DL/review bulgusu) | Öncelik (P1/P2/P3) | Not |
|---|------|---------------------------|--------------------|-----|
| TD-1 | `deploy/remote-deploy.sh` `/data`'yı `-v` ile bağlamıyor — her deploy'da SQLite dosyası sıfırlanabilir (NFR-3 ihlali riski) | DL-05-003 (mimari taahhüt), DL-12-001 (bilinen boşluk), DL-14-001/checkpoint Faz 12 | **P1** | Üretime gerçek deploy öncesi mutlaka kapatılmalı — veri kalıcılığını doğrudan etkiler |
| TD-2 | `node:sqlite` Node 22'de deneyseldir; sürüm sabitlemesi (Dockerfile `node:22-alpine`) var ama Node minor güncellemelerinde API kırılma riski izlenmeli | DL-05-002, docs/05-architecture.md açık risk | P2 | Node LTS geçişlerinde regresyon testi çalıştır |
| TD-3 | Log-tabanlı izleme; ayrı metrik/alert altyapısı yok (log satırından p95/error-rate manuel türetilir) | DL-14-001 | P3 | Trafik/kullanıcı sayısı arttığında Prometheus+alertmanager değerlendirilebilir |
| TD-4 | Faz 10 (Code Review) LITE profilde atlandı — kod bağımsız denetimden geçmedi | `profiles.json` `LITE.skipped["10"]` (AF-112) | P2 | Ürün büyür/kritikleşirse STANDARD/FULL'a yükseltilip Faz 10 çalıştırılmalı (`/pipeline-upgrade`) |

## Bağımlılık güncelleme planı
- Sıfır npm bağımlılığı (yalnız `node:*` stdlib, DL-05-002) → dependency-drift riski minimal; yalnız Node runtime sürümü takip edilir.
- Dependabot/otomasyon gerekmez (bağımlılık yok); Node major sürüm değişimlerinde `node:sqlite` API'sinin stable'a geçişi manuel izlenir (TD-2).

## Bakım ritmi
- Her sürüm öncesi: `npm test` (99 test) yeşil + `docker build` başarılı kontrolü.
- 3 ayda bir: Node LTS güncellemesi değerlendirmesi + TD-1'in (volume mount) hâlâ açık olup olmadığının kontrolü.

## Kalite kapısı raporu
- "Teknik borç önceliklendirilmiş" → ✅ (4 borç, her biri kaynak DL/review referansıyla izlenebilir, öncelik atanmış)
