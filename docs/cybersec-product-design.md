# Aegis — Agentic Security Platform
## Kapsamli UX Tasarim Dokumani

---

## 1. Product Narrative

**Aegis**, sirketinizin dijital varliklarini (web uygulamalari, cloud altyapisi, kod depolari, domainler) yapay zeka destekli otonom ajanlarla surekli tarayarak guvenlik aciklari bulan, her bulguyu kanitla dogrulayan ve cozum adimlariyla birlikte ilgili kisiye ileten bir guvenlik platformudur.

### 5 Deger Onerisi

1. **Otonom Kesif & Test** — Ajanlar, varliklarinizi otomatik kesfeder ve guvenlik testlerini insan mudehalesi olmadan calistirir. Siz uyurken bile tarama devam eder.
2. **Kanit-Tabanli Bulgular** — Her bulgu, "gercekten sismirildigi" request/response kaniti ile gelir. False positive'leri sifira yakin dusurur.
3. **Insan Dilinde Aciklamalar** — Teknik jargon yerine "Bu acik ne anlama geliyor, kimi etkiliyor, ne yapilmali" dilinde sonuclar uretir.
4. **Tek Tikla Aksiyon** — Bulgudan Jira ticket'ina, Slack bildirimine veya remediation adimina 1 tikla gecis.
5. **Surekli Dogrulama** — Fix yapildiginda otomatik retest calistirip "gercekten kapandi mi?" sorusunu yanitlar.

---

## 2. Kullanici Profilleri (Personas)

### Persona A: Teknik Olmayan Yonetici (CISO / CTO / VP Eng)

| Alan | Detay |
|------|-------|
| **Hedefler** | Sirketin guvenlik durusunu tek bakista gormek. Yonetim kuruluna "durumumuz su" diyebilmek. Risk trendini takip etmek. |
| **Korkular** | Teknik detaylarda bogulmak. Yanlis onceliklendirme yaparak kritik bir acigi gozden kacirmak. "Breach" sonrasi "neden bilmiyordunuz?" sorusu. |
| **Basari Kriteri** | 2 dakikada risk ozetini gorup, "en kritik 3 konu nedir ve kimin ustunde?" sorusuna cevap verebilmeli. |
| **Kullanim Sikligi** | Haftada 1-2 kez dashboard'a bakar, monthly rapor alir. |

### Persona B: Guvenlik Muhendisi / Pentester

| Alan | Detay |
|------|-------|
| **Hedefler** | Tum bulgulari detayli gormek. Kaniti dogrulamak. Attack chain'i anlamak. False positive'leri isaretlemek. |
| **Korkular** | Gurultulu sonuclar (cok fazla false positive). Yeterli kanit olmamasi. Scope disina cikma riski. |
| **Basari Kriteri** | Her bulgunun kanitini gorup, 30 saniyede "gercek mi, degil mi?" kararini verebilmeli. Tek tikla retest baslatabilmeli. |
| **Kullanim Sikligi** | Gunluk aktif kullanici. Her tarama sonrasinda bulgulari inceler. |

### Persona C: IT/DevOps / Platform Sahibi

| Alan | Detay |
|------|-------|
| **Hedefler** | Entegrasyonlari hizli ve guvenli kurmak. Hangi izinlerin neden gerektigi net olmali. Sistemin altyapiya etkisini bilmek. |
| **Korkular** | Cok fazla izin vermek. Taramanin production'i etkilemesi. Credential'larin guvenli saklanip saklanmadigi. |
| **Basari Kriteri** | 15 dakikada ilk entegrasyonu kurup, test taramasini baslatabilmeli. Verilen izinlerin ne icin kullanildigini acikca anlayabilmeli. |
| **Kullanim Sikligi** | Baslangicta yogun (kurulum), sonra haftalik monitoring. |

---

## 3. Information Architecture (Menu Yapisi)

```
Aegis
|
+-- Dashboard (Executive)
|   +-- Risk Ozeti (skor + trend)
|   +-- Kritik Bulgular (top 5)
|   +-- Varlik Haritasi
|   +-- "Simdi Ne Yapmali?" paneli
|
+-- Taramalar (Scans)
|   +-- Aktif Taramalar (progress + log)
|   +-- Tarama Gecmisi
|   +-- Yeni Tarama Baslat
|
+-- Bulgular (Findings)
|   +-- Tum Bulgular (filtrelenebilir liste)
|   +-- Bulgu Detay (kanit + etki + cozum)
|   +-- Attack Chains
|   +-- False Positive Isaretleme
|
+-- Varliklar (Assets)
|   +-- Kesfedilen Varliklar
|   +-- Gruplar & Etiketler
|   +-- Kapsam Ayarlari (scope)
|
+-- Entegrasyonlar (Integration Center)
|   +-- Kimlik & Erisim
|   +-- Kaynaklar & Varliklar
|   +-- Tarama / Teslimat
|   +-- Bildirim & Ticket
|   +-- Raporlama & Uyum
|
+-- Raporlar
|   +-- Executive Report (PDF)
|   +-- Compliance Mapping
|   +-- Trend Analizi
|
+-- Ayarlar
|   +-- Takim & Roller
|   +-- Bildirim Tercihleri
|   +-- API Anahtarlari
|   +-- Nasil Calisir? (surekli erisilebilir)
```

---

## 4. Ilk Giris Deneyimi (Onboarding)

### 4.1 Karsilama Ekrani

```
+----------------------------------------------------------+
|                                                          |
|                    Aegis'e Hosgeldiniz                    |
|                                                          |
|    Varliklarinizi kesfeden, guvenlik testlerini          |
|    otonom calistiran ve her bulguyu kanitla              |
|    dogrulayan yapay zeka destekli guvenlik platformu.    |
|                                                          |
|    Nasil baslamak istersiniz?                            |
|                                                          |
|    [  Hizli Tur (60 sn)  ]                              |
|    Urunu 5 adimda taniyin                               |
|                                                          |
|    [  Kurulum Sihirbazi  ]                              |
|    Ilk entegrasyonu kurup tarama baslatin               |
|                                                          |
|    [  Demo Modu  ]                                       |
|    Ornek verilerle urunun ciktilarini gorun             |
|                                                          |
+----------------------------------------------------------+
```

### 4.2 Hizli Tur (60 saniye, 5 adim)

**Adim 1/5 — Varliklarinizi Baglayin**
> Aegis, cloud hesaplariniz, kod depolariniz ve domainlerinizi tarar.
> Entegrasyon Center'dan kaynaklarinizi baglayin — Aegis gerisi halleder.

**Adim 2/5 — Ajanlar Calismaya Baslar**
> Yapay zeka destekli ajanlar, varliklarinizi otomatik kesfeder ve guvenlik testleri uygular. Her test, gercek bir saldirgani simule eder.

**Adim 3/5 — Bulgular Kanitla Gelir**
> Her bulgu, "bunu gercekten kullanabilir miyiz?" sorusunun cevabini icerir.
> Request/response kaniti, etkilenen varliklar ve CVSS skoru bulgunun parcasidir.

**Adim 4/5 — Insan Dilinde Cozum**
> "Bu acik ne anlama geliyor?" ve "Nasil kapatilir?" sorularina net cevaplar.
> Teknik detay isteyenler icin tam kanit, yonetim icin ozet gorunum.

**Adim 5/5 — Tek Tikla Aksiyon**
> Bulgulardan dogrudan Jira ticket'i, Slack bildirimi veya email olusturun.
> Fix yapildiginda Aegis otomatik retest yapar ve "kapandi" onaylar.

### 4.3 Demo Modu

Demo modu, hicbir entegrasyon gerektirmeden ornek bir dataset ile urunun tam ciktilarini gosterir.

```
+----------------------------------------------------------+
|  DEMO MODU AKTIF                                [Kapat]  |
|  Ornek verilerle calisiyorsunuz.                         |
|  Gercek tarama icin entegrasyon kurun.  [Kuruluma Gec]   |
+----------------------------------------------------------+
|                                                          |
|  Executive Dashboard                                     |
|  +-----------+  +-----------+  +-----------+             |
|  | RISK SKORU|  | ACIK      |  | KAPANAN   |             |
|  | 72/100    |  | 23 Bulgu  |  | 8 Bulgu   |             |
|  | Orta      |  | 3 Kritik  |  | Bu hafta  |             |
|  +-----------+  +-----------+  +-----------+             |
|                                                          |
|  En Kritik 5 Konu:                                       |
|  1. SQL Injection — api.ornek.com/users  [KRITIK]        |
|  2. Acik S3 Bucket — prod-assets        [YUKSEK]         |
|  3. Expired SSL — payments.ornek.com    [YUKSEK]         |
|  4. Weak Admin Password — CMS panel     [ORTA]           |
|  5. CORS Misconfiguration — API         [ORTA]           |
|                                                          |
|  [Bulgu detaylarini incele]  [Ornek rapor indir]         |
|                                                          |
+----------------------------------------------------------+
```

Demo'da kullanici bir bulguya tikladiginda tam detayi gorur — kanit, etki, cozum. Boylece "entegrasyonlari kurarsam gercek sonuclar boyle gorunecek" anlayisi olusur.

### 4.4 Kurulum Sihirbazi

```
Adim 1/4 — Takim
  "Birlikte calisacaginiz ekibi davet edin (sonra da yapabilirsiniz)"
  [Email adresleri girin veya atla]

Adim 2/4 — Ilk Kaynak Baglama
  "Taranacak ilk varligi secin:"
  ( ) Web Uygulamasi (URL girerek)
  ( ) Cloud Hesabi (AWS/GCP/Azure)
  ( ) Kod Deposu (GitHub/GitLab)
  ( ) Domain (DNS taramasi)
  [Sadece 1 tane secmeniz yeterli — daha sonra ekleyebilirsiniz]

Adim 3/4 — Entegrasyon Kurulumu
  [Secilen kaynaga ozel adimlar — asagida detaylandirildi]

Adim 4/4 — Ilk Taramayi Baslat
  "Her sey hazir! Ilk taramanizi baslatalim."
  [Taramayi Baslat]
  Tahmini sure: ~15 dakika (varlik sayisina gore degisir)
```

---

## 5. Entegrasyon Akisi (Integration Center)

### 5.1 Kategori Yapisi

#### Kimlik & Erisim
> Kullanicilarinizin kim oldugunu ve nasil giris yaptigini baglayarak erisim kontrolu saglar.

| Entegrasyon | Ne Ise Yarar | Ne Verir | Kurulum Suresi | Gerekli Izinler | Risk/Not |
|-------------|-------------|----------|----------------|-----------------|----------|
| **Okta SSO** | Tek girisli kimlik dogrulama saglar | Kullanici listesi, rol bilgisi, giris kayitlari | ~5 dk | Read-only API token. Kullanici verilerinizi okur ama degistirmez. | Veriler Aegis'te sifrelenerek saklanir. |
| **Azure AD** | Microsoft kimlik altyapisini baglar | Kullanici ve grup bilgileri, MFA durumlari | ~10 dk | Directory.Read.All izni. Sadece okuma — degisiklik yapmaz. | Enterprise consent gerektirebilir. |
| **Google Workspace** | Google kimlikleriyle calisir | Kullanici listesi, admin rolleri | ~5 dk | Admin SDK read-only. Sadece okuma. | Super admin onayi gerekir. |

#### Kaynaklar & Varliklar
> Taranacak hedeflerinizi tanimlar: cloud hesaplari, kod depolari, domainler.

| Entegrasyon | Ne Ise Yarar | Ne Verir | Kurulum Suresi | Gerekli Izinler | Risk/Not |
|-------------|-------------|----------|----------------|-----------------|----------|
| **AWS** | AWS altyapinizi tarar (S3, EC2, IAM vb.) | Varlik envanteri, yapilandirma hatalari, acik portlar | ~10 dk | SecurityAudit policy (read-only). Hicbir kaynak degistirmez. | Cross-account role oneriyoruz — dogrudan key paylasmaktan guvenli. |
| **GitHub** | Kod depolarinizi tarar | Kod icindeki sirlar (API key, password), bagimliliklardaki aciklar | ~3 dk | Repo read izni. Kod'a yazmaz, sadece okur. | Private repo erisimi verilir — sadece secilen repo'lar taranir. |
| **Domain/URL** | Web uygulamalarinizi disaridan tarar | Disaridan gorunen acik yuzey, subdomain'ler, SSL durumu | ~1 dk | Izin gerekmez — public tarama. | Production'a zarar vermez: agresif olmayan tarama. |

#### Tarama / Teslimat
> Ajanin varliklariniza nasil ulasacagini belirler.

| Entegrasyon | Ne Ise Yarar | Ne Verir | Kurulum Suresi | Gerekli Izinler | Risk/Not |
|-------------|-------------|----------|----------------|-----------------|----------|
| **Aegis Agent** | Ic agdaki varliklari taramak icin hafif bir agent kurulur | Ic ag varlik kesfii, yapilandirma analizi | ~15 dk | Agent binary'yi sunucuya yukleyin. Outbound HTTPS yeterli. | Agent read-only calisir. Sistem kaynaklari: <100MB RAM, <1% CPU. |
| **Kubernetes Connector** | K8s cluster'larinizi tarar | Pod, service, RBAC yapilandirmasi, image aciklari | ~10 dk | ClusterRole: read-only. Hicbir pod/service degistirmez. | Sadece metadata okur — container icine girmez. |

#### Bildirim & Ticket
> Sonuclarin kime, nasil iletilecegini belirler.

| Entegrasyon | Ne Ise Yarar | Ne Verir | Kurulum Suresi | Gerekli Izinler | Risk/Not |
|-------------|-------------|----------|----------------|-----------------|----------|
| **Slack** | Kritik bulgulari Slack kanalina gonderir | Gercek zamanli bildirimler, bulgu ozeti | ~2 dk | Incoming webhook. Sadece mesaj atar, kanal okuMaz. | Hangi kanala gidecegini siz secersiniz. |
| **Jira** | Bulgulardan otomatik ticket olusturur | Issue olusturma, durum senkronu | ~5 dk | Jira API token + proje yazma izni. Sadece belirttiginiz projede ticket acar. | Mevcut ticket'lari degistirmez — sadece yeni olusturur. |
| **Email** | Rapor ve ozet email'leri gonderir | Haftalik ozet, kritik bulgu bildirimi | ~1 dk | SMTP ayarlari veya Aegis'in email servisi | Sadece tanimladiginiz adreslere gonderir. |

#### Raporlama & Uyum
> Uyumluluk standartlariyla eslestirme ve raporlama saglar.

| Entegrasyon | Ne Ise Yarar | Ne Verir | Kurulum Suresi | Gerekli Izinler | Risk/Not |
|-------------|-------------|----------|----------------|-----------------|----------|
| **SOC 2 Mapping** | Bulgulari SOC 2 kontrolleriyle eslestirir | Uyumluluk raporu, kontrol bazli gorunum | Entegrasyon gerekmez | Yok — dahili eslestirme | Otomatik haritalama, auditor'a hazir format. |
| **OWASP Top 10** | Bulgulari OWASP kategorilerine gore siniflandirir | Kategori bazli risk gorunumu | Entegrasyon gerekmez | Yok | Her bulgu otomatik olarak OWASP'a eslesir. |

### 5.2 Entegrasyon Karti Tasarimi

```
+----------------------------------------------------------+
|  [AWS Logosu]  Amazon Web Services              [Test Et] |
|                                                          |
|  Ne ise yarar?                                           |
|  AWS altyapinizi (S3, EC2, IAM, Lambda) guvenlik         |
|  acisindan tarar ve yapilandirma hatalarini bulur.       |
|                                                          |
|  Ne verir?                                               |
|  Varlik envanteri, yanlis yapilandirilmis servisler,     |
|  acik portlar, asiri yetkili IAM rolleri                 |
|                                                          |
|  Kurulum suresi: ~10 dakika                              |
|  Gerekli izinler: SecurityAudit (read-only)              |
|                                                          |
|  Neden bu izni istiyoruz?                                |
|  Kaynaklarinizi listelemek ve yapilandirmasini okumak    |
|  icin. Hicbir kaynak olusturmaz, degistirmez veya       |
|  silmez.                                                 |
|                                                          |
|  Durum: ( ) Not connected                                |
|         ( ) Connected                                    |
|         ( ) Partial (2/5 hizmet baglandi)                |
|         ( ) Error: Credential expired                    |
|                                                          |
|  [Baglantiyi Kur]                                        |
+----------------------------------------------------------+
```

---

## 6. "Urun Nasil Calisir?" Akis Semasi

Bu gorsel, uygulama icinde her zaman erisilebilir ("Nasil Calisir?" butonu sidebar'da sabit durur).

```
    [1]              [2]              [3]              [4]              [5]
  HEDEF SEC    →   AJANLAR       →  BULGULAR      →  ANALIZ &      →  CIKTI &
                   CALISIR          TOPLANIR         DOGRULAMA        AKSIYON
     |                |                |                |                |
     v                v                v                v                v

 +---------+    +---------+     +---------+     +---------+     +---------+
 | Domain, |    | Kesif:  |     | Ham     |     | Etki    |     | Rapor   |
 | Cloud,  |    | Ne var? |     | sonuclar|     | analizi |     | (PDF)   |
 | Repo,   |    |         |     | bir     |     |         |     |         |
 | URL     |    | Test:   |     | araya   |     | Kanit   |     | Ticket  |
 | secin   |    | Acik    |     | gelir   |     | esleme  |     | (Jira)  |
 |         |    | var mi? |     |         |     |         |     |         |
 |         |    |         |     | Noise   |     | Oneri   |     | Bildi-  |
 |         |    | Dogrula:|     | azaltma |     | uretme  |     | rim     |
 |         |    | Gercek  |     | (tekilestirme) |         |     | (Slack) |
 |         |    | mi?     |     |         |     |         |     |         |
 +---------+    +---------+     +---------+     +---------+     +---------+
   ~1 dk          ~10-30 dk       Otomatik        Otomatik        Aninda
   Sizden:        Sizden:         Sizden:         Sizden:         Sizden:
   URL/cred       Bir sey         Bir sey         Bir sey         Review +
   girin          gerekmez        gerekmez        gerekmez        onay

   Cikti:         Cikti:          Cikti:          Cikti:          Cikti:
   Taranacak      Ham test        Tekilestirilmis Severity +      PDF, Jira
   varlik         sonuclari       bulgu listesi   kanit +         ticket,
   listesi                                        cozum onerisi   Slack msg
```

### Adim Detaylari

**Adim 1 — Hedef Sec**
- Ne olur: Taranacak varligi secersiniz (URL, cloud hesabi, repo, domain)
- Ne kadar surer: ~1 dakika
- Sizden ne ister: Hedef bilgisi + bagli entegrasyon credential'i
- Cikti: Taranacak varlik listesi olusur

**Adim 2 — Ajanlar Calisir**
- Ne olur: AI ajanlar 3 asamada calisir. Kesif (ne var?), Test (acik var mi?), Dogrulama (gercek mi?)
- Ne kadar surer: 10-30 dakika (varlik buyuklugune gore)
- Sizden ne ister: Hicbir sey — tamamen otonom
- Cikti: Ham test sonuclari (binlerce kontrol noktasi)

**Adim 3 — Bulgular Toplanir**
- Ne olur: Ayni acigin farkli belirtileri tekilestirilir (orn: ayni SQL injection 3 endpoint'te bulunduysa tek bulgu olur). Gurultu azaltilir.
- Ne kadar surer: Otomatik, saniyeler icinde
- Sizden ne ister: Hicbir sey
- Cikti: Temiz, tekilestirilmis bulgu listesi

**Adim 4 — Analiz & Dogrulama**
- Ne olur: Her bulguya CVSS skoru, etki analizi, kok neden ve cozum onerisi eklenir. Kanit (request/response) eslenir.
- Ne kadar surer: Otomatik
- Sizden ne ister: Hicbir sey
- Cikti: Severity + kanit + cozum onerisi iceren zengin bulgular

**Adim 5 — Cikti & Aksiyon**
- Ne olur: Sonuclar dashboard'da goruntulenir. Jira ticket, Slack bildirimi veya PDF rapor olusturabilirsiniz.
- Ne kadar surer: Aninda
- Sizden ne ister: Review ve onay (hangi bulgulari ticket'a donustureceksiniz?)
- Cikti: Rapor, ticket, bildirim

---

## 7. Sonuc Ekranlari (Output Tasarimi)

### 7.1 Executive Dashboard

```
+----------------------------------------------------------+
|  AEGIS DASHBOARD                         Son: 2 saat once |
|                                                          |
|  +----------+  +----------+  +----------+  +----------+  |
|  | RISK     |  | ACIK     |  | KAPANAN  |  | ORTALAMA |  |
|  | SKORU    |  | BULGULAR |  | (30 gun) |  | COZUM    |  |
|  |          |  |          |  |          |  | SURESI   |  |
|  |  72/100  |  |    23    |  |    47    |  |  3.2 gun |  |
|  |  ORTA    |  | 3 Kritik |  | -15% ay  |  | -1.1 gun |  |
|  +----------+  +----------+  +----------+  +----------+  |
|                                                          |
|  Risk Trendi (son 90 gun)                                |
|  [===== grafik: iyilesme trendi gorsel =====]            |
|                                                          |
|  SIMDI NE YAPMALI?                                       |
|  +------------------------------------------------------+|
|  | 1. SQL Injection — api.sirket.com/users    [KRITIK]  ||
|  |    Kullanici verilerine yetkisiz erisim riski.       ||
|  |    Atanan: Ahmet Y. | SLA: 48 saat                  ||
|  |    [Detay]  [Jira'da Gor]                            ||
|  |                                                      ||
|  | 2. Acik S3 Bucket — prod-assets-2024      [YUKSEK]   ||
|  |    Hassas dosyalar internetten erisilebilir.          ||
|  |    Atanan: Atanmadi | SLA: 72 saat                   ||
|  |    [Detay]  [Sahip Ata]                              ||
|  |                                                      ||
|  | 3. Expired SSL — payments.sirket.com      [YUKSEK]   ||
|  |    Musteriler guvenlik uyarisi goruyor.              ||
|  |    Atanan: DevOps | SLA: 24 saat                     ||
|  |    [Detay]  [Jira'da Gor]                            ||
|  +------------------------------------------------------+|
|                                                          |
|  [Executive Rapor Indir (PDF)]  [Tam Bulgu Listesi]      |
+----------------------------------------------------------+
```

### 7.2 Security View (Bulgu Listesi)

```
+----------------------------------------------------------+
|  BULGULAR                          23 acik | 47 kapandi  |
|                                                          |
|  Filtre: [Severity v] [Varlik v] [Durum v] [Tip v]      |
|  Siralama: [Severity] [Tarih] [Varlik] [SLA]            |
|                                                          |
|  +------------------------------------------------------+|
|  | KRITIK  SQL Injection                    api.sirket  ||
|  |         POST /api/users?id=1' OR '1'='1              ||
|  |         Dogrulandi | Kanit mevcut                    ||
|  |         Atanan: Ahmet Y. | 36 saat kaldi             ||
|  |                                                      ||
|  | YUKSEK  Open S3 Bucket                   AWS/prod    ||
|  |         s3://prod-assets public-read ACL              ||
|  |         Dogrulandi | Kanit mevcut                    ||
|  |         Atanan: — | SLA asildi                        ||
|  |                                                      ||
|  | YUKSEK  Expired SSL Certificate        payments.co   ||
|  |         Sertifika 2024-12-15 tarihinde doldu          ||
|  |         Dogrulandi                                    ||
|  |         Atanan: DevOps | 12 saat kaldi               ||
|  |                                                      ||
|  | ORTA    CORS Misconfiguration             api.sirket  ||
|  |         Access-Control-Allow-Origin: *                ||
|  |         Dogrulandi                                    ||
|  |         Atanan: — | Atanmadi                          ||
|  +------------------------------------------------------+|
+----------------------------------------------------------+
```

### 7.3 Bulgu Detay Karti (Standart Alanlar)

```
+----------------------------------------------------------+
|  [<- Geri]                                               |
|                                                          |
|  SQL Injection                              KRITIK       |
|  ========================================================|
|                                                          |
|  ETKILENEN VARLIKLAR                                     |
|  api.sirket.com/api/users (POST)                         |
|  api.sirket.com/api/orders (GET)                         |
|                                                          |
|  ETKI (ne anlama geliyor?)                               |
|  Bir saldirgan, bu acigi kullanarak veritabaniniza       |
|  dogrudan sorgular gonderebilir. Kullanici bilgileri     |
|  (isim, email, sifre hash'leri) calinabiir.              |
|  En kotu senaryo: Tum veritabani icerigi sizdirilabilir. |
|                                                          |
|  KANIT                                                   |
|  +----------------------------------------------------+  |
|  | Request:                                            | |
|  | POST /api/users HTTP/1.1                            | |
|  | Content-Type: application/json                      | |
|  | {"id": "1' OR '1'='1' --"}                          | |
|  |                                                     | |
|  | Response:                                           | |
|  | HTTP/1.1 200 OK                                     | |
|  | [{"id":1,"name":"Admin","email":"admin@co.com"},    | |
|  |  {"id":2,"name":"User","email":"user@co.com"},...]  | |
|  |                                                     | |
|  | Tum kullanici kayitlari donduruldu — acik           | |
|  | dogrulandi.                                         | |
|  +----------------------------------------------------+  |
|                                                          |
|  KOK NEDEN                                               |
|  Kullanici girdisi (input), veritabani sorgusuna         |
|  dogrudan ekleniyor. Parameterized query (hazir sorgu)   |
|  kullanilmiyor.                                          |
|                                                          |
|  COZUM ADIMLARI                                          |
|  Kisa:                                                   |
|  Parameterized query / prepared statement kullanin.       |
|                                                          |
|  Detay:                                                  |
|  1. /api/users endpoint'inde `id` parametresini          |
|     dogrudan SQL string'ine eklemek yerine               |
|     prepared statement kullanin.                         |
|  2. ORM kullaniyorsaniz raw query yerine ORM'in          |
|     built-in filtreleme metodlarini tercih edin.         |
|  3. Input validation ekleyin: `id` sadece integer        |
|     kabul etmeli.                                        |
|  4. WAF (Web Application Firewall) kurallarini           |
|     gunceleyin.                                          |
|                                                          |
|  DOGRULAMA DURUMU                                        |
|  ( ) Dogrulanmadi (Unverified)                           |
|  (x) Dogrulandi (Verified) — 2024-02-20 14:32           |
|  ( ) Duzeltildi (Fixed)                                  |
|  ( ) Retest Gerekli                                      |
|                                                          |
|  AKSIYONLAR                                              |
|  [Jira Ticket Ac]  [Slack'e Gonder]  [Email ile Paylas]  |
|  [Sahip Ata: _____]  [Retest Baslat]                    |
|  [False Positive Olarak Isaretle]                        |
|                                                          |
|  DETAYLAR                                                |
|  CVSS: 9.8 | CWE-89 | OWASP A03:2021                    |
|  Ilk Gorulme: 2024-02-18 | Son Tarama: 2024-02-20       |
|  Attack Chain: Recon -> SQLi -> Data Exfiltration        |
+----------------------------------------------------------+
```

### 7.4 Action View (Remediation Takip)

```
+----------------------------------------------------------+
|  AKSIYONLAR                                              |
|                                                          |
|  Filtre: [Tumu] [Atanmis] [SLA Asilan] [Retest Bekleyen]|
|                                                          |
|  +------------------------------------------------------+|
|  | SQL Injection — api.sirket.com            KRITIK     ||
|  | Sahip: Ahmet Y.  |  SLA: 48 saat (12 saat kaldi)    ||
|  | Durum: Uzerinde calisiliyor                          ||
|  | Jira: SEC-142 (In Progress)                          ||
|  | [Detay]  [Retest Baslat]  [Jira'da Gor]             ||
|  |                                                      ||
|  | Open S3 Bucket — prod-assets              YUKSEK     ||
|  | Sahip: ATANMADI  |  SLA: ASILDI (24 saat)           ||
|  | Durum: Aksiyon bekleniyor                            ||
|  | Jira: Olusturulmadi                                  ||
|  | [Sahip Ata]  [Ticket Olustur]                        ||
|  |                                                      ||
|  | CORS Misconfiguration — api               ORTA       ||
|  | Sahip: Backend Team  |  SLA: 7 gun (5 gun kaldi)    ||
|  | Durum: Fix yapildi — Retest bekliyor                 ||
|  | Jira: SEC-138 (Done)                                 ||
|  | [Retest Baslat]  [Karsilastir: Once/Sonra]           ||
|  +------------------------------------------------------+|
+----------------------------------------------------------+
```

---

## 8. Dil ve Mikrocopy Kurallari

### 8.1 Teknik Terim Aciklamalari

Her teknik terimin yaninda parantez icinde kisa aciklama:

- **SQL Injection** (veritabanina yetkisiz sorgu gondererek veri calmak)
- **CVSS 9.8** (10 uzerinden risk skoru — 9+ kritik demektir)
- **S3 Bucket** (AWS'in dosya depolama servisi)
- **CORS** (tarayicinin baska sitelere istek gonderme kurallari)
- **WAF** (web uygulamasinin onundeki guvenlik filtresi)
- **Parameterized Query** (kullanici girdisini guvenli sekilde veritabanina ileten yontem)
- **CWE-89** (bu acik turunu tanimlayan uluslararasi kod)
- **OWASP A03** (en yaygin web guvenlik aciklarinin 3. sirasi)
- **Retest** (fix yapildiktan sonra acigin gercekten kapandigini dogrulama)

### 8.2 "Neden Bunu Istiyoruz?" Metinleri

Her izin ekraninda gorunur:

> **AWS SecurityAudit izni neden gerekiyor?**
> Kaynaklarinizi (sunucular, veritabanlari, depolama alanlari) listelemek ve yapilandirmasini okumak icin. Bu izin sadece okuma yetkisi verir — hicbir kaynak olusturmaz, degistirmez veya silmez.

> **GitHub repo read izni neden gerekiyor?**
> Kod icerisinde yanlislikla birakilmis API anahtarlari, sifreler veya gizli bilgileri taramak icin. Kodunuza yazmaz, sadece okur.

> **Slack webhook neden gerekiyor?**
> Kritik bulgular bulundugunda sectiginiz kanala bildirim gondermek icin. Aegis sadece mesaj gonderir — kanallarinizi okumaz veya mevcut mesajlari degistirmez.

### 8.3 Hata Mesajlari (ne oldu + neden + nasil duzelir)

```
NE OLDU: AWS baglantisi basarisiz.
NEDEN: Girilen Access Key ID gecersiz veya suresi dolmus.
NASIL DUZELTIR:
1. AWS Console > IAM > Users > Security Credentials'a gidin
2. Yeni bir Access Key olusturun
3. Burada tekrar girin
[Tekrar Dene]  [Yardim Dokumani]
```

```
NE OLDU: GitHub repo taramasi baslatilMadi.
NEDEN: Secilen repo'ya erisim izniniz yok (private repo, yetersiz token scope).
NASIL DUZELTIR:
1. GitHub > Settings > Tokens'a gidin
2. Token'in "repo" scope'unu icerdiginden emin olun
3. Yeni token olusturun ve burada guncelleyin
[Token Guncelle]  [Yardim]
```

```
NE OLDU: Jira ticket olusturulamadi.
NEDEN: Belirtilen Jira projesinde ticket olusturma yetkiniz yok.
NASIL DUZELTIR:
Jira yoneticinizden ilgili projede "Create Issue" izni isteyin, veya
farkli bir proje secin.
[Proje Degistir]  [Tekrar Dene]
```

### 8.4 Bos Durum Metinleri (CTA ile)

```
Henuz bulgu yok.
Ilk taramanizi baslatarak varliklarinizin guvenlik durumunu ogrenin.
[Tarama Baslat]
```

```
Entegrasyon eklenmemis.
Aegis'in varliklarinizi tarayabilmesi icin en az bir kaynak baglayIN.
[Entegrasyon Ekle]
```

```
Bu varlIk icin henuz tarama yapilmadi.
[Simdi Tara]  veya  [Zamanlanmis Tarama Ayarla]
```

```
Hic aksiyon olusturulmamis.
Bulgulardan birine sahip atayarak veya ticket olusturarak baslayabilirsiniz.
[Bulgulara Git]
```

---

## 9. Edge Case Ekranlari

### 9.1 Credential Yanlis / Izin Eksik

```
+----------------------------------------------------------+
|  ! AWS Baglantisi — Izin Hatasi                          |
|                                                          |
|  Mevcut credential ile S3 ve IAM hizmetlerine            |
|  erisilebildi, ancak EC2 ve RDS icin yetki eksik.        |
|                                                          |
|  Baglanan Hizmetler:                                     |
|  [x] S3          [x] IAM                                |
|  [ ] EC2 — DescribeInstances izni eksik                  |
|  [ ] RDS — DescribeDBInstances izni eksik                |
|                                                          |
|  Secenekler:                                             |
|  [Kismi Baglantiyla Devam Et]                            |
|    Sadece S3 ve IAM taranir.                             |
|                                                          |
|  [Izinleri Guncelle]                                     |
|    Gerekli policy'yi kopyalayip AWS'e ekleyin.           |
|    [Policy JSON'u Kopyala]                               |
|                                                          |
|  [Iptal]                                                 |
+----------------------------------------------------------+
```

### 9.2 Entegrasyon Yarim Kaldi

```
+----------------------------------------------------------+
|  Tamamlanmamis Kurulumlar                                |
|                                                          |
|  AWS — Adim 2/3'te kaldi                    [Devam Et]   |
|  Son deneme: 2 saat once                                 |
|  Kalinan yer: Cross-account role olusturma               |
|                                                          |
|  GitHub — Adim 1/2'de kaldi                [Devam Et]    |
|  Son deneme: dun                                         |
|  Kalinan yer: Token girisi                               |
|                                                          |
|  [Tamamlanmamis Entegrasyonlari Temizle]                 |
+----------------------------------------------------------+
```

### 9.3 Uzun Suren Tarama (Progress + Log)

```
+----------------------------------------------------------+
|  Tarama Devam Ediyor                                     |
|  api.sirket.com | Baslangic: 14:32 | Gecen sure: 18 dk  |
|                                                          |
|  [====================>              ] %62               |
|                                                          |
|  Simdi Ne Yapiyor?                                       |
|  Adim 2/3: Guvenlik testleri uygulanIyor                 |
|  Son islem: XSS testleri — /api/search endpoint'i        |
|                                                          |
|  Canli Log Ozeti:                                        |
|  14:32  Tarama basladi — 847 endpoint kesfedildi         |
|  14:35  Authentication testleri tamamlandi (0 bulgu)     |
|  14:38  Input validation testleri basliyor...            |
|  14:42  SQL Injection bulundu — /api/users (KRITIK)      |
|  14:45  XSS testleri devam ediyor...                     |
|                                                          |
|  Simdiye Kadar: 3 bulgu (1 kritik, 1 yuksek, 1 orta)    |
|                                                          |
|  [Taramayi Durdur]  [Arka Planda Calistir]               |
|  Tarama bittiginde Slack'e bildirim gonderilecek.        |
+----------------------------------------------------------+
```

### 9.4 False Positive SUphesi (Kullanici Geri Bildirimi)

```
+----------------------------------------------------------+
|  Bu bulgu yanlis mi? (False Positive)                    |
|                                                          |
|  Bulgu: CORS Misconfiguration — api.sirket.com           |
|                                                          |
|  Neden yanlis oldugunu dusunuyorsunuz?                   |
|  ( ) Bu kasitli bir yapilandirma (intended behavior)     |
|  ( ) Farkli bir guvenlik kontrolu mevcut (WAF, vb.)     |
|  ( ) Kanit gecersiz / yanlis yorumlanmis                 |
|  ( ) Diger: [________________]                           |
|                                                          |
|  Ek not (opsiyonel):                                     |
|  [________________________________________________]      |
|                                                          |
|  Ne olacak?                                              |
|  Bu bulgu "False Positive" olarak isaretlenecek ve       |
|  gelecek taramalarda otomatik olarak filtrelenecek.      |
|  Istediginiz zaman geri alabilirsiniz.                   |
|                                                          |
|  [False Positive Isaretle]  [Vazgec]                     |
+----------------------------------------------------------+
```

### 9.5 Retest Akisi (Oncesi/Sonrasi Karsilastirma)

```
+----------------------------------------------------------+
|  Retest Sonucu — SQL Injection                           |
|                                                          |
|  ONCEKI TARAMA (2024-02-18)          BU TARAMA (SIMDI)   |
|  Durum: ACIK                         Durum: KAPANDI      |
|                                                          |
|  Kanit Karsilastirmasi:                                  |
|  +------------------------+  +------------------------+  |
|  | Request: ayni           | | Request: ayni           | |
|  | Response:               | | Response:               | |
|  | 200 OK                  | | 400 Bad Request         | |
|  | [tum kullanici verisi]  | | {"error":"invalid id"}  | |
|  +------------------------+  +------------------------+  |
|                                                          |
|  Sonuc: Acik basariyla kapatilmis.                       |
|  Input validation eklenmis, parameterized query           |
|  kullanilmis.                                            |
|                                                          |
|  [Duzeltildi Olarak Isaretle]  [Tekrar Test Et]          |
+----------------------------------------------------------+
```

---

## 10. 3 Ana User Journey

### Journey A: Ilk Giris (Teknik Olmayan Yonetici)

```
1. Karsilama ekrani → "Demo Modu" secer
2. Ornek dashboard'u gorur: risk skoru, kritik bulgular
3. Bir bulguya tiklar → insan dilinde etki + cozum okur
4. "Tamam, gercek verilerimle gorelim" → Kurulum Sihirbazi'na gecer
5. IT ekibini davet eder (entegrasyonu onlar kuracak)
6. Ilk gercek tarama sonrasinda executive dashboard'u gorur
7. "Simdi Ne Yapmali?" panelinden ilk aksiyonu tetikler
```

### Journey B: Entegrasyon Kurulumu (DevOps)

```
1. Davet email'i ile giris yapar
2. Integration Center'a gider
3. "Kaynaklar & Varliklar" kategorisinde AWS'i secer
4. Entegrasyon kartini okur: ne izin isteniyor, neden
5. Cross-account role olusturur (adim adim guide ile)
6. [Test Et] butonuna basar → "3/4 hizmet baglandi" gorur
7. Eksik izni ekler → tekrar test → "Connected"
8. Ilk taramayi baslatir
```

### Journey C: Ilk Sonuc Inceleme (Guvenlik Muhendisi)

```
1. Tarama bitti bildirimi (Slack) alir
2. Bulgular sayfasina gider, Severity ile filtreler
3. Kritik bulguyu acar → kaniti inceler (request/response)
4. "Dogrulandi" olarak isaretler
5. Cozum adimlarini okur
6. [Jira Ticket Ac] → ilgili developer'a atanir
7. Developer fix yapar → [Retest Baslat]
8. Retest sonucu: "KAPANDI" → oncesi/sonrasi karsilastirma gorur
9. Bulguyu "Fixed" olarak isaretler
```

---

## 11. Basari Kriteri Testi

Asagidaki senaryo 10 dakika icinde tamamlanabilmeli:

| Adim | Sure | Islem |
|------|------|-------|
| 0:00 | Giris | Kullanici ilk kez uygulamaya girer |
| 0:30 | Anlama | "Demo Modu" ile urunun ne yaptigini gorur |
| 2:00 | Karar | "Bu benim isime yarar" kararini verir |
| 3:00 | Kurulum | Ilk entegrasyonu secip kurmaya baslar |
| 7:00 | Baglanti | Entegrasyon "Connected" durumuna gecer |
| 7:30 | Tarama | Ilk taramayi baslatir |
| 8:00 | Bekleme | Progress ekraninda ne oldugunu takip eder |
| 9:00 | Sonuc | Ilk bulgulari gorur |
| 10:00 | Aksiyon | Bir bulguyu okuyup "ne yapacagim" kararini verir |

Bu 10 dakikalik testte kullanici:
- Urunun ne yaptigini anlar
- Ilk entegrasyonu kurar
- Ornek bir hedef secer
- Ciktiyi okur
- "Simdi ne yapmaliyim?" sorusuna cevap verir
