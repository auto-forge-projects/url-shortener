# 04 — Çözüm Analizi: url-shortener

- Tarih: 2026-07-27 | Mod: AUTOPILOT | Profil: LITE

## Karar problemi
FR-1 (kısa kod üretimi, **kalıcı depoda saklanır**), FR-2 (kod→URL yönlendirme/404), FR-3 (geçersiz URL reddi) için
**depolama mekanizması** ve **kısa kod üretim stratejisi** seçilecek.
Belirleyici NFR'ler: NFR-1 ≤200ms p95, NFR-2 yalnız http/https, NFR-3 %100 hedef eşleşme, NFR-4 çakışma = 0.
Kısıtlar: LITE profili (tek geliştirici, küçük yüzey), Faz 9 "sıfır dış bağımlılık" hedefi, tek süreçli Node servisi, Docker imajı tek container.

## Karar 1 — Depolama

### Alternatifler (kalite kapısı: ≥2 GERÇEK alternatif)
- **A — Bellek-içi Map + periyodik JSON snapshot.** Tüm eşlemeler `Map`'te; N saniyede bir / kapanışta `data.json`'a yazılır, açılışta okunur.
- **B — Gömülü SQL (`node:sqlite`, Node ≥22.5).** Tek dosya DB; `links(code TEXT PRIMARY KEY, url TEXT NOT NULL, created_at INTEGER)`. Dış paket yok (stdlib).
- **C — Dosya-tabanlı KV (append-only JSONL + bellek indeksi).** Her yeni eşleme `links.jsonl`'a atomik append; açılışta dosya okunup indeks kurulur.

### Trade-off matrisi
| Kriter | A: Map + snapshot | B: node:sqlite | C: JSONL append + indeks |
|--------|-------------------|----------------|--------------------------|
| NFR-1 (≤200ms p95) | ✅ O(1) bellek, ~µs | ✅ PK index, <1ms (yerel dosya) | ✅ O(1) bellek okuma; yazı = 1 append+fsync |
| NFR-2 (şema reddi) | ⊘ nötr — uygulama katmanı işi | ⊘ nötr | ⊘ nötr |
| NFR-3 (%100 doğru yönlendirme) | ❌ snapshot arası çökme = **kayıp eşleme** | ✅ commit'lenen kayıt kalıcı | ✅ append+fsync sonrası kalıcı |
| NFR-4 (çakışma = 0) | ⚠️ yalnız uygulama kontrolü (kod hatası sessizce üzerine yazar) | ✅ **PRIMARY KEY** ile depo düzeyinde kod-enforced (INSERT hata verir) | ⚠️ yalnız uygulama kontrolü; ayrıca duplicate satır fark edilmez |
| FR-1 "kalıcı depo" uyumu | ❌ karşılamıyor (asıl kayıt bellekte) | ✅ | ✅ |
| Dış bağımlılık | Yok | Yok (stdlib `node:sqlite`) | Yok |
| Karmaşıklık (LOC/kavram) | En düşük (~30 LOC) | Düşük (~50 LOC, SQL bilgisi) | Orta (~70 LOC: append + fsync + boot replay + bozuk satır toleransı) |
| Eşzamanlı yazım güvenliği | ⚠️ snapshot yazımı yarış üretir | ✅ tek yazar + transaction | ⚠️ kısmi satır riski (elle ele alınmalı) |
| Test edilebilirlik | ✅ trivial | ✅ `:memory:` DB ile izole test | ⚠️ tmp dosya kurulumu gerekir |
| Maliyet (altyapı) | 0 | 0 (tek dosya volume) | 0 |
| Geri alınabilirlik | Yüksek | **Yüksek** — `LinkStore` arayüzü arkasında; migrasyon = `SELECT *` → dışa aktarım | Yüksek |
| Olgunluk riski | — | ⚠️ `node:sqlite` Node 22'de deneysel (ExperimentalWarning) | — |

### Seçim: **B — gömülü `node:sqlite`**
**Gerekçe:**
- **A elendi**: FR-1 açıkça "kalıcı depoda saklanır" der; snapshot penceresi içinde çöküş NFR-3'ün (%100 doğru yönlendirme) test edilebilir garantisini kırar — kayıp eşleme 404 üretir.
- **C elendi**: kalıcılığı sağlar ama NFR-4'ü yalnız uygulama koduna dayandırır; ayrıca kısmi satır/boot replay dayanıklılığı A ve B'den daha ÇOK kod ister — LITE'ta en kötü takas (fazla karmaşıklık, az garanti).
- **B seçildi**: NFR-4 (çakışma 0) `PRIMARY KEY` ile **veri katmanında** zorlanır — benzersizlik testi kod hatasında bile geçemez, kapı gerçek olur. NFR-1 tek satır PK araması ile fazlasıyla karşılanır (bütçenin ~%1'i). Dış bağımlılık yok → Faz 9 sıfır-bağımlılık hedefi ve tek-container paketleme korunur. `:memory:` DB sayesinde Faz 11 entegrasyon testleri izole ve hızlı.
- **Kilitlenme riski düşük**: erişim `LinkStore { get(code), put(code,url) }` arayüzünden geçer; SQL yalnız tek adaptör dosyasında. Deneysel API sorun çıkarırsa adaptör C'ye (JSONL) ~1 saatte değiştirilir, veri `SELECT *` ile taşınır.

## Karar 2 — Kısa kod üretimi (NFR-4/NFR-1 belirleyici)

| Kriter | D: Rastgele base62 (7 hane, çakışmada yeniden dene) | E: Monotonik sayaç → base62 |
|--------|------------------------------------------------------|------------------------------|
| NFR-4 (çakışma 0) | ✅ PK ihlalinde retry (≤3), tükenirse 500 | ✅ tanımı gereği benzersiz |
| NFR-1 | ✅ 1 INSERT (çakışma olasılığı ~0, 62^7 uzay) | ✅ 1 INSERT |
| Tahmin edilemezlik (enumeration) | ✅ kodlar sıralı değil | ❌ ardışık kodlar tüm linkleri taranabilir kılar |
| Karmaşıklık | Düşük (retry döngüsü) | Düşük (sayaç kalıcılığı gerekir) |
| Geri alınabilirlik | Yüksek (üretici tek fonksiyon) | Yüksek |

**Seçim: D — rastgele base62 + PK çakışmasında retry.** E, sayaç kalıcılığı derdine rağmen kodları
tahmin edilebilir yapıyor; NFR-2'nin güvenlik ruhuyla (kötü niyetli girdiye kapalı olma) çelişir. D'de
benzersizlik hem üretici hem PRIMARY KEY tarafından iki katmanlı garanti edilir.

## NFR ↔ çözüm ön-eşlemesi (Faz 5'te detaylandırılacak)
| NFR | Bu kararın karşılığı |
|-----|----------------------|
| NFR-1 ≤200ms p95 | Tek PK araması + tek INSERT; ağ çağrısı/dış servis yok |
| NFR-2 http/https | Depodan BAĞIMSIZ: `new URL()` + şema allowlist, **kayıt öncesi** doğrulama katmanı |
| NFR-3 %100 doğruluk | Commit'lenmiş satır = kalıcı eşleme; `:memory:` DB ile entegrasyon testi |
| NFR-4 çakışma 0 | `code` PRIMARY KEY (depo düzeyi) + rastgele 62^7 uzay + retry (uygulama düzeyi) |

## Kalite kapısı raporu
- "En az 2 alternatif karşılaştırıldı" → ✅ (Karar 1: 3 alternatif × 12 kriter; Karar 2: 2 alternatif × 5 kriter)
- "Seçim NFR'lere bağlandı" → ✅ (NFR-1..4 hem matriste hem eşleme tablosunda satır satır)
- Decision Log → ✅ DL-04-001 (depolama), DL-04-002 (kod üretimi)
