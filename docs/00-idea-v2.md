# 00 — Yeni İhtiyaç (↺ REQ-001): url-shortener

- Tarih: 2026-07-31 | Cycle: 2 | Mod: AUTOPILOT (mevcut `default_mode` korunur)
- Bildirim e-postası: sametemek@windowslive.com

## Talep (birebir)
> "Uygulama açılmıyor"

## Sınıflandırma
- **Tür:** patch (davranış/FR değişmiyor — mevcut mimari taahhüdün deploy'da eksik uygulanması)
- **Hedef faz:** 12 (CI/CD — `deploy/remote-deploy.sh`)
- **Gerekçe:** kök neden zaten dosya kanıtıyla belgeli, bkz. aşağı.

## Kök neden (mevcut kanıt — canlı prob bu oturumda ağ erişimi kısıtlı olduğu için tekrarlanamadı, VARSAYIM olarak işaretlendi, kural 8)
- `docs/05-architecture.md`: DB yolu dışarı alındı, "Faz 12 Dockerfile `VOLUME /data` + deploy `-v` bağlaması **ZORUNLU** kabul edilir."
- `docs/12-cicd.md` "Bilinen boşluk" + `docs/15-maintenance.md` **TD-1 (P1)**: `deploy/remote-deploy.sh:start_container()` `docker run` çağrısında `/data` için kalıcı bir `-v` bağlaması YOK. `docker rm -f` + yeniden `docker run` her deploy'da anonim/varsayılan bir hacim üretir → SQLite dosyası (tüm kısa linkler) kaybolabilir.
- Sonuç: kullanıcı önceden oluşturulmuş bir kısa linke gittiğinde (veya bir yeniden-deploy sonrası genel olarak) veri sıfırlanmış olabilir → "uygulama açılmıyor" algısı. Bu, mimarinin kendi taahhüdüne (yukarıdaki alıntı) aykırı, zaten P1 önceliğiyle kayıtlı bir teknik borç (DL-05-003, DL-12-001).

## Kapsam
- **İÇİNDE:** `deploy/remote-deploy.sh` → `start_container()`'a isimli Docker volume (`${PROJECT}-data:/data`) mount et; container yeniden oluşturulsa da veri kalıcı volume'da kalır.
- **DIŞINDA:** Fabrika-geneli `deploy/templates/` şablonunun aynı düzeltmeyi alması bu delta'nın kapsamı dışıdır (yalnız url-shortener'ın kendi kopyası düzeltiliyor); aynı kalıp diğer nginx-mode projelerini de etkileyebileceği için `AUTOFORGE-FEEDBACK.md`'ye fabrika eksikliği olarak ayrıca not düşülecek.
- `src/` davranışı DEĞİŞMİYOR — FR/NFR aynı kalıyor.

## Etkilenen fazlar (AF-091 türetilmiş geçersizlik)
- **12 (hedef):** `deploy/remote-deploy.sh` fix + DL-12-002.
- **13:** patch sürüm artışı (v0.1.0 → v0.1.1) + release notes'a değişiklik notu.
- **14:** "Kritik risk 2 — DB kalıcılığı" notu çözüldü olarak güncellenir.
- **15:** TD-1 kapanır.
- **16:** içerik etkilenmiyor, yalnız yeniden onay.
- Faz 10: LITE'ta zaten atlanıyor (`profiles.LITE.skipped`); Faz 11: `src/` değişmediği için dokunulmuyor.
