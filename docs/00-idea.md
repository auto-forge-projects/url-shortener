# 00 — Fikir (Intake)

## Problem (tek cümle)
Kullanıcıların uzun URL'leri kısa, paylaşılabilir bir bağlantıya çevirip bu bağlantıya erişildiğinde orijinal adrese yönlendirilmesini sağlayan bir web uygulaması yok.

## Kim için
Uzun linkleri (sosyal medya, mesajlaşma, dokümantasyon) kısaltıp paylaşmak isteyen genel/solo kullanıcı.

## Kapsam (v1)
- URL gönder → benzersiz kısa kod üret (rastgele, ≤200ms)
- Kısa link ziyareti → orijinal URL'e 3xx yönlendirme
- Geçersiz/bozuk URL girişini kayıt öncesi reddet
- Anonim kullanım (hesap/giriş yok), sunucu tarafı kalıcı eşleme (dosya/DB)

## Kapsam dışı (v1)
- Kullanıcı hesabı/giriş, kişisel link geçmişi
- Tıklama analitiği/istatistik paneli
- Özel (custom) kısa kod seçimi
- Link son kullanma tarihi/otomatik silme

## Kaynak
Onaylı brief: `docs/00-refined-brief.md`

## Kalite kapısı raporu
Problem tek cümlede tanımlı ✅ (yukarıda)
