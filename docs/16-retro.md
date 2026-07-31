# 16 — Retrospektif: AutoForge pipeline'ı (url-shortener koşusu)

- Tarih: 2026-07-27 | Mod: AUTOPILOT | Girdi: `AUTOFORGE-FEEDBACK.md` (commit-queue yarış koşulu bulgusu, url-shortener Faz 9 resume'i)
- Kapsam: FABRİKA değerlendirilir, ürün değil.

## Ne iyi gitti
- LITE profil (Faz 1+2 birleşik, Faz 10 atlandı) küçük bir "anonim kısalt+yönlendir" servisi için doğru ölçekte kaldı — 16 fazın tamamı 0'dan 15'e kadar ~1.5 saatte, tek insan onay gerektirmeden (AUTOPILOT) tamamlandı.
- Sıfır-bağımlılık mimari kararı (yalnız `node:http`/`node:sqlite`/`node:test`) Faz 9→11→12 zincirinde hiç sürtünme üretmedi; TDD red→green commit disiplini (AF-093 mekanik kapı) Faz 9'un ORPHANED_RUN kesintisinden resume edilirken diske-doğrulama ile (kural 3d, AF-038) doğru noktadan devam edildi — hiçbir tamamlanmış TASK tekrar yazılmadı.
- Faz kapanış commit'leri boyunca **hiç `git commit` doğrudan çalıştırılmadı** (AF-106 kuralı tam uygulandı) — `--request-commit` + kuyruk-boşaltma (`commit-queue.mjs --drain`) her seferinde çalıştı, dashboard koşmasa bile hiçbir faz commit'siz `running`'de takılmadı.

## En önemli öğrenim
Commit kuyruğunun `nextPending()` fonksiyonu atomik bir "claim" işlemi yapmıyor — bir job'ı `processing` gibi ara bir duruma anlık işaretlemeden yalnız `SELECT ... WHERE status='pending'` okuyor. Bu oturumda (Faz 9 resume) dashboard'un arka plan tick'i ile CLI'dan elle çağrılan `--drain` aynı ana denk geldiğinde, ikisi de aynı pending job'ı görüp bağımsız olarak commit attı → git log'da aynı mesajla İKİ commit oluştu (biri gerçek diff, diğeri yalnız `pipeline-state.json` farkı). Sonuç zararsızdı (push edildi, mekanik kapı doğru sırayı gördü) ama bu, "kuyruk = tek-yazarlı serileştirme" varsayımının yanlış olduğunu gösterdi — kuyruk okuma anında değil, işleme anında rakip erişime karşı korumasız.

## Kök-neden temaları (AF kayıtları → temalar)
| Tema | İlgili AF | Özet |
|------|-----------|------|
| Eşzamanlı erişimde "oku-sonra-yaz" deseni yarış koşuluna açık | commit-queue yarış koşulu bulgusu (bu koşu, henüz AF numarasız) | `nextPending()` SELECT + ayrı UPDATE — iki süreç arasında atomik değil; state-db tarafında `withWriteTx`/`BEGIN IMMEDIATE` (AF-104/M1) bu deseni zaten çözmüştü, commit-queue aynı ilkeyi almadı |
| Headless özerklikte commit'i asla ELLE çalıştırmama disiplini | AF-105, AF-106 | Bu koşuda kural sorunsuz işledi: `--request-commit` + `commit-queue.mjs --drain` iki kez (Faz 13, 14, 15 kapanışlarında) sorunsuz çalıştı — geçmiş "izin bekleyip asılma" hatası tekrarlanmadı |

## Ek doğrulama (↺ REQ-001 delta, 2026-07-31)
Aynı yarış koşulu bu delta koşumunda (Faz 12-15 reclose) BİR KEZ DAHA gözlendi — bu sefer dashboard-vs-CLI değil, **iki farklı proje** (`url-shortener` ve eşzamanlı çalışan `ball-bounce`) aynı paylaşımlı `commit_queue` tablosunu aynı anda boşaltırken (id 90 için `cc858bd` + ardından yalnız `pipeline-state.json` farkı taşıyan `6ec4335`; id 93 için de benzer `1f8d2c1`+`2463385` çifti). Sonuç yine zararsızdı (push başarılı, mekanik kapı etkilenmedi) ama **Öneri 1'in önceliği P2'den daha aciliyetli değerlendirilmeli** — tekrarlanma tek koşumda değil, farklı projeler arası da gerçekleşiyor.

## Ek doğrulama (↺ REQ-002 delta, 2026-07-31)
Aynı yarış koşulu ÜÇÜNCÜ bir varyantla bir kez daha gözlendi — bu sefer ne dashboard-vs-CLI ne de proje-arası: **orchestrator'ın kendisi, zaten çalışmakta olan dashboard sürecinin (`dashboard/` `node server.js`, arka planda) yanında elle `commit-queue.mjs --drain` çağırdı.** Faz 9 kapanış commit'i (#103) için manuel drain çağrıldığında dashboard'un kendi tick'i AYNI job'ı zaten işlemişti; sonuç `git log`'da birebir aynı mesajlı iki commit (`c21d772` + `3a717fe`, ikisi de "phase(9): Development delta — REQ-002 BASE_URL fix + DL-09-002"). Zararsız (ikisi de push edildi, mekanik kapı etkilenmedi) ama CLAUDE.md kural 3'ün "dashboard koşmayan bir oturumdaysan kuyruğu kendin boşalt" notunun tam tersi bir kullanım hatasıydı — dashboard sürecinin canlı olup olmadığı kontrol edilmeden manuel drain çağrıldı. Kalan fazlar (11-15) için manuel drain çağrılmadı ve hepsi dashboard'un otomatik tick'iyle sorunsuz commit'lendi — bu da Öneri 1'in (dashboard-pid kontrolü) doğru azaltım olduğunu bir kez daha doğruluyor.

## Somut süreç iyileştirmeleri (kalite kapısı: ≥1)
### Öneri 1 — commit-queue'da atomik claim **[P2 → P1'e yükseltilmeli, üç bağımsız koşuda tekrarlandı — henüz uygulanmadı]**
`scripts/lib/commit-queue.cjs:nextPending()` tek SELECT yerine atomik `UPDATE ... SET status='processing' WHERE id = (SELECT id FROM commit_queue WHERE status='pending' ... LIMIT 1) RETURNING *` deseni (ya da eşdeğer `BEGIN IMMEDIATE` transaction) kullanmalı — iki süreç (dashboard tick + CLI `--drain`) aynı job'ı asla ikinci kez claim edemez. Ek/alternatif: `--drain` çağrısı `dashboard/runs/server.pid` (veya canlı bir `/api/state` sağlık ucu) canlılığını kontrol edip "dashboard zaten boşaltıyor, elle drain gerekmiyor" uyarısı versin — REQ-002 delta'sında bu kontrol olsaydı Faz 9 kapanışındaki çift-commit hiç oluşmazdı.

### Öneri 2 — Faz kapanışında `--drain` çağrısı öncesi kısa gecikme/kontrol **[P3, önerildi]**
Orchestrator dokümantasyonuna (`.claude/commands/pipeline-resume.md` ve CLAUDE.md kural 3) "dashboard aktifse `--drain`'i elle tekrar tetikleme, kuyruk zaten otomatik boşalır" notu eklenebilir — bu, Öneri 1 uygulanana kadar geçici bir davranışsal azaltım olur.

## MASTER-PROMPT / CLAUDE.md / şablon değişiklik önerileri
1. `scripts/lib/commit-queue.cjs` → `nextPending()` atomik UPDATE+RETURNING deseniyle yeniden yazılmalı (Öneri 1); test: iki eşzamanlı `--drain` çağrısının aynı job'ı yalnız BİR kez işlediğini doğrulayan regresyon testi eklenmeli.
2. CLAUDE.md kural 3 (commit tarifi) altına "dashboard koşuyorsa kuyruk zaten otomatik boşalır, elle `--drain` yalnız dashboard KAPALIYSA gereklidir" notu eklenebilir (Öneri 2).

## Kalite kapısı raporu
- "En az 1 somut süreç iyileştirmesi" → ✅ (2 öneri: commit-queue atomik claim [P2] + dokümantasyon notu [P3], her ikisi de bu koşunun kendi AUTOFORGE-FEEDBACK.md bulgusundan türetildi)
