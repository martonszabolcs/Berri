# 📱 BERRĪ Document Scanner

## Áttekintés

A BERRĪ Document Scanner egy professzionális mobil alkalmazás, amely valós időben detektálja és szkenneli a BERRĪ füzeteket. Az alkalmazás automatikusan felismeri a füzet keretét, QR kódot detektál, és professzionális minőségű szkennelt képet készít a füzetoldalakról.

---

## ✨ Főbb Funkciók

### 1. 🎯 Automatikus Dokumentum Detektálás
- **Valós idejű keresés**: Az alkalmazás folyamatosan keresi a BERRĪ füzet keretét
- **Intelligens sarok detektálás**: Automatikusan megtalálja a füzet 4 sarkát
- **Vizuális visszajelzés**: Zöld kontúr jelzi a detektált dokumentumot
- **Konfidencia jelzés**: Százalékos visszajelzés a detektálás minőségéről

### 2. 📍 QR Kód Pozícionálás
- **Automatikus QR felismerés**: Detektálja a füzet alján lévő QR kódot
- **Pozíció azonosítás**: Meghatározza, hogy a QR kód bal vagy jobb oldalon van
- **Vizuális jelzés**: "✓ QR kód beolvasva" üzenet

### 3. 📸 Professzionális Szkennelés
- **Egy kattintásos fotózás**: Nagy zöld gomb a képernyő alján
- **Automatikus perspektíva korrekció**: A ferde képeket is egyenessé alakítja
- **Professzionális feldolgozás**:
  - Automatikus fényerő optimalizálás
  - Kontrasztfokozás
  - Élesítés (sharpening)
  - Színtelítettség fokozás
  - Fehér háttér és fekete szöveg kiemelése

### 4. 🎨 Ikon Detektálás
- **8 szegmenses elemzés**: A füzet alján található ikon sáv automatikus feldolgozása
- **7 különböző ikon felismerése**:
  - Nyíl
  - Gyémánt
  - Alma
  - Csengő
  - Lóhere
  - Csillag
  - Patkó
- **Intelligens pozícionálás**: A QR kód alapján optimalizálja az ikon sáv helyzetét

### 5. 📤 Megosztás Funkció
- **Azonnali megosztás**: A szkennelt kép megosztása más alkalmazásokkal
- **Natív integráció**: iOS és Android megosztási lehetőségek
- **Támogatott célpontok**: WhatsApp, Email, Google Drive, stb.

### 6. 💡 Villanó Támogatás
- **Beépített flash**: Rossz fényviszonyok esetén
- **Egy érintéses kapcsoló**: Gyors be/kikapcsolás

### 7. 🎯 Tap-to-Focus
- **Manuális fókuszálás**: Érintsd meg a képernyőt a fókusz beállításához
- **Vizuális visszajelzés**: Sárga kör jelzi a fókuszpont helyét

---

## 📖 Használati Útmutató

### Első Lépések

1. **Indítsd el az alkalmazást**
2. **Engedélyezd a kamera hozzáférést** (első használatkor)
3. **Tartsd a telefont a BERRĪ füzet fölé**

### Dokumentum Szkennelése

#### 1. lépés: Pozícionálás
```
┌─────────────────────────────┐
│  "Keresd a BERRĪ keretét"   │  ← Kezdeti státusz
└─────────────────────────────┘

↓ (Amikor megtalálja a keretet)

┌─────────────────────────────┐
│  "BERRĪ észlelve! (45%)"    │  ← Alacsony konfidencia
└─────────────────────────────┘

↓ (Menj közelebb)

┌─────────────────────────────┐
│  "Menj közelebb (60%)"      │  ← Közepes távolság
└─────────────────────────────┘

↓ (Megfelelő távolság)

┌─────────────────────────────┐
│  "BERRĪ észlelve! (85%)"    │  ← Jó konfidencia
│  "✓ QR kód beolvasva"       │
└─────────────────────────────┘
```

#### 2. lépés: Ellenőrzés
- **Zöld kontúr**: Pontosan illeszkedik a füzet széleire
- **Konfidencia > 80%**: Optimális minőség fotózáshoz
- **QR kód beolvasva**: Ikon detektálás engedélyezve

#### 3. lépés: Fotózás
- **Nyomd meg a zöld capture gombot** (képernyő alja középen)
- Az alkalmazás automatikusan:
  - Készít egy nagy felbontású fotót
  - Perspektíva korrekciót alkalmaz
  - Professzionális scan effektet alkalmaz
  - Detektálja az ikonokat
  - Megjeleníti az eredményt

#### 4. lépés: Megosztás vagy Bezárás
- **Megosztás gomb** (bal felső sarok): Megosztás más alkalmazásokkal
- **Bezárás gomb** (jobb felső sarok): Vissza a kamerához

---

## 🎛️ Felhasználói Felület

### Főképernyő Elemei

```
┌─────────────────────────────────────┐
│  [Debug] [🔦 Flash]           [?]   │  ← Felső eszköztár
├─────────────────────────────────────┤
│                                     │
│                                     │
│         📷 KAMERA KÉP               │
│                                     │
│         (Zöld kontúr overlay)       │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  "BERRĪ észlelve! (85%)"            │  ← Státusz üzenet
│  "✓ QR kód beolvasva"               │
├─────────────────────────────────────┤
│              [ 📸 ]                 │  ← Capture gomb
└─────────────────────────────────────┘
```

### Szkennelt Kép Modal

```
┌─────────────────────────────────────┐
│  [📤 Megosztás]         [✕ Bezár]   │  ← Modal fejléc
├─────────────────────────────────────┤
│                                     │
│                                     │
│      📄 SZKENNELT KÉP               │
│                                     │
│      (Ikon detektálás eredménye)    │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔍 Státusz Üzenetek Magyarázata

| Üzenet | Jelentés | Mit tegyek? |
|--------|----------|-------------|
| **"Keresd a BERRĪ keretét"** | Nincs dokumentum detektálva | Tartsd a telefont a füzet fölé |
| **"BERRĪ észlelve! (45%)"** | Alacsony konfidencia | Javítsd a megvilágítást, tartsd stabilabban |
| **"Menj közelebb (60%)"** | Túl messze vagy | Menj közelebb a füzethez |
| **"BERRĪ észlelve! (85%)"** | Jó minőség | Fotózásra kész! |
| **"✓ QR kód beolvasva"** | QR kód detektálva | Ikon detektálás aktív |
| **"⚠️ Tartsd szemben a füzettel!"** | Ferde pozíció | Tartsd a telefont párhuzamosan a füzettel |

---

## 💡 Tippek és Trükkök

### Legjobb Eredmény Eléréséhez

1. **Jó Megvilágítás**
   - Természetes fény (ablak mellett) ideális
   - Használd a villanót rossz fényviszonyok esetén
   - Kerüld a túl erős árnyékokat

2. **Stabil Pozíció**
   - Tartsd stabilanTelefonját
   - Támaszd alá a kézfejedet
   - Várj 1-2 másodpercet a stabilizálódáshoz

3. **Megfelelő Távolság**
   - A füzet töltse ki a képernyő ~70%-át
   - Ne legyen túl közel (kameránál)
   - Ne legyen túl messze (konfidencia < 60%)

4. **Párhuzamos Pozíció**
   - Tartsd a telefont párhuzamosan a füzettel
   - Kerüld a ferde szögeket
   - Ha figyelmeztetést kapsz, igazítsd a pozíciót

### Debug Mód Használata

A **Debug gomb** (bal felső sarok) kapcsolja be/ki a debug módot:
- **BE**: Látható a feldolgozott kép (fekete-fehér)
- **KI**: Csak a kamera feed látszik

**Mikor hasznos?**
- Ha nem detektál: lásd, hogy mit "lát" az algoritmus
- Ha rossz sarkok: ellenőrizd a kontúr detektálást
- Fejlesztői célokra

---

## 🔧 Gyakori Problémák Megoldása

### Probléma: Nem Detektál Dokumentumot

**Lehetséges Okok:**
- ❌ Rossz megvilágítás
- ❌ Túl kicsi a füzet a képen
- ❌ Ferde pozíció

**Megoldások:**
1. Kapcsold be a villanót
2. Menj közelebb
3. Tartsd a telefont párhuzamosan
4. Próbálj meg tap-to-focus-t használni

### Probléma: Villogó Detektálás

**Ok:** A konfidencia 70% körül ingadozik

**Megoldás:**
- Tartsd stabilabban a telefont
- Javítsd a megvilágítást
- Várj pár másodpercet a stabilizálódásra

### Probléma: Rossz Fotó Minőség

**Lehetséges Okok:**
- ❌ Mozgó kamera (blur)
- ❌ Rossz fény
- ❌ Piszkos kamera lencse

**Megoldások:**
1. Tartsd stabilan fotózáskor
2. Használd a villanót
3. Tisztítsd meg a lencsét

### Probléma: QR Kód Nem Detektálódik

**Ellenőrizd:**
- A QR kód látható és nem takarják?
- Megfelelő felbontás (nem túl messze)?
- Jó megvilágítás?

### Probléma: Ikonok Nem Detektálódnak

**Ok:** QR kód nem lett beolvasva

**Megoldás:**
1. Ellenőrizd a QR kód láthatóságát
2. Várj a "✓ QR kód beolvasva" üzenetre
3. Akkor fotózz

---

## 📊 Technikai Részletek (Haladóknak)

### Detektálási Algoritmus

Az alkalmazás valós időben, 30-60 FPS sebességgel dolgozza fel a kamera képkockáit. A teljes folyamat ~16-33ms alatt fut le frame-enként.

#### 1. Frame Preprocessing (Előfeldolgozás)

**Cél:** A feldolgozási sebesség optimalizálása a minőség megtartása mellett.

```
Eredeti Frame (pl. 1920x1080)
         ↓
Resize Algorithm (INTER_AREA)
         ↓
Feldolgozott Frame (max 1080px)
```

**Részletek:**
- **Max dimenzió:** 1080px (a nagyobbik él)
- **Aspect ratio megőrzés:** Igen, arányos átméretezés
- **Interpoláció:** INTER_AREA (downscaling-hez optimális)
- **Teljesítmény nyereség:** 3-4x gyorsabb feldolgozás
- **Minőség veszteség:** Minimális, a detektáláshoz elegendő

**Példa:**
```
1920x1080 → 1080x608  (landscape)
1080x1920 → 608x1080  (portrait)
```

#### 2. Brightness Seeker (Adaptív Fényerő Kalibrálás)

**Cél:** Automatikusan megtalálni az optimális fényerő offsetet különböző fényviszonyok mellett.

**Működési Elv:**
```
Inicializálás: brightnessOffset = 0

Minden frame-ben:
  1. Alkalmazd az offsetet a képre
  2. Próbálj meg dokumentumot detektálni
  
  Ha DETEKTÁLT:
    offset += STEP (20)  // Világosabbá teszi
  Ha NEM DETEKTÁLT:
    offset -= STEP (20)  // Sötétebbre teszi
    
  Clamp: offset ∈ [-100, +100]
```

**Matematikai Formula:**
```
adjustedImage = saturate(originalImage × α + offset)

ahol:
  α = 1.0 (szorzó)
  offset ∈ [-100, +100]
  saturate() = min(255, max(0, value))
```

**Adaptív Viselkedés:**
- **Sötét környezet:** offset → +100 (világosítás)
- **Világos környezet:** offset → -100 (sötétítés)
- **Optimális fény:** offset → 0 körül stabilizálódik
- **Konvergencia:** ~20-30 frame alatt (0.5-1 másodperc)

**Gyakorlati Példa:**
```
Frame 1:  offset = 0    → Nem detektál → offset = -20
Frame 2:  offset = -20  → Nem detektál → offset = -40
Frame 3:  offset = -40  → Detektált! ✓ → offset = -20
Frame 4:  offset = -20  → Detektált! ✓ → offset = 0
Frame 5:  offset = 0    → Detektált! ✓ → offset = 20
...
Stabilizálódás: offset ≈ 10 (optimális)
```

#### 3. Edge Detection (Éldetektálás)

**Két párhuzamos módszer kombinációja:**

**A) Adaptív Threshold Módszer:**
```
Grayscale → GaussianBlur (5x5) → AdaptiveThreshold
                                         ↓
                                  Binary Image (fekete-fehér)
```

**Paraméterek:**
- **Block Size:** 25×25 pixel (lokális környezet)
- **C Konstans:** 10 (küszöb offset)
- **Threshold Type:** ADAPTIVE_THRESH_MEAN_C
- **Bináris érték:** 255 (fehér) vagy 0 (fekete)

**B) Canny Edge Detector:**
```
Grayscale → GaussianBlur (5×5) → Canny(50, 150)
                                      ↓
                                  Edge Image (élek)
```

**Paraméterek:**
- **Lower Threshold:** 50 (gyenge élek küszöbe)
- **Upper Threshold:** 150 (erős élek küszöbe)
- **Aperture:** 3×3 Sobel kernel
- **Hysteresis:** Automatikus él követés

**Kombináció:**
```
adaptiveResult = AdaptiveThreshold(blurred)
cannyResult = Canny(blurred, 50, 150)

finalImage = bitwise_OR(adaptiveResult, cannyResult)
```

#### 4. Morfológiai Műveletek

**Cél:** Zajszűrés és élfolytonosság javítása

```
Binary Image
     ↓
Morphological Close (5×5 kernel)  // Lyukak betöltése
     ↓
Dilate (5×5 kernel, 1 iteráció)   // Élek vastagítása
     ↓
Tisztított Binary Image
```

**MORPH_CLOSE Hatása:**
```
Előtte:  ═══ ═══ ═══    (szaggatott él)
Utána:   ═══════════    (folytonos él)
```

#### 5. Contour Detection (Kontúr Detektálás)

**OpenCV findContours:**
```
Binary Image → findContours(RETR_EXTERNAL, CHAIN_APPROX_SIMPLE)
                    ↓
              Lista: [contour1, contour2, ...]
```

**Polygon Approximáció (4 sarok keresése):**

Az algoritmus 4 különböző epsilon értékkel próbálkozik:

```
EPSILON_VALUES = [0.005, 0.01, 0.02, 0.05]

for (epsilon in EPSILON_VALUES) {
  arcLength = perimeter(contour)
  approxPoly = approxPolyDP(contour, epsilon × arcLength, closed=true)
  
  if (approxPoly.length === 4) {
    // Megtaláltuk a 4 sarkot! ✓
    break
  }
}
```

**Epsilon Értékek Jelentése:**
- **0.005 (0.5%):** Nagyon pontos approximáció (finom részletek)
- **0.01 (1%):** Pontos approximáció
- **0.02 (2%):** Közepes approximáció
- **0.05 (5%):** Durva approximáció (nagy egyszerűsítés)

**Példa:**
```
Kontúr kerülete: 2000 pixel

epsilon = 0.005 → ε = 10 pixel tűrés  → 4 sarok ✓
epsilon = 0.01  → ε = 20 pixel tűrés  → 4 sarok ✓
epsilon = 0.02  → ε = 40 pixel tűrés  → 4 sarok (kevésbé pontos)
```

#### 6. Validálás (Minőség Ellenőrzés)

**A) Méret Validálás:**
```
documentArea = contourArea(approxPoly)
frameArea = frameWidth × frameHeight

areaRatio = documentArea / frameArea

✓ VALID if: 0.1 ≤ areaRatio ≤ 0.95
```

**Jelentés:**
- **< 10%:** Túl kicsi, valószínűleg zaj vagy távoli objektum
- **10-95%:** Megfelelő méret
- **> 95%:** Túl nagy, valószínűleg nem dokumentum (teljes képernyő)

**B) Aspect Ratio Validálás:**
```
// Oldal hosszak számítása
topLength = distance(topLeft, topRight)
bottomLength = distance(bottomLeft, bottomRight)
leftLength = distance(topLeft, bottomLeft)
rightLength = distance(topRight, bottomRight)

avgWidth = (topLength + bottomLength) / 2
avgHeight = (leftLength + rightLength) / 2

aspectRatio = avgHeight / avgWidth  // Portrait (álló)

✓ VALID if: aspectRatio ≥ 0.9 (kb. álló téglalap)
```

**C) Oldal Arányosság Ellenőrzés:**
```
horizontalRatio = max(topLength, bottomLength) / 
                  min(topLength, bottomLength)

verticalRatio = max(leftLength, rightLength) / 
                min(leftLength, rightLength)

✓ VALID if: 
  horizontalRatio ≤ 5.0  // Felső/alsó oldal hasonló
  verticalRatio ≤ 5.0    // Bal/jobb oldal hasonló
```

**D) Solidity Validálás:**
```
convexHull = convexHull(approxPoly)
hullArea = contourArea(convexHull)

solidity = documentArea / hullArea

✓ VALID if: solidity ≥ 0.8  // 80% tömörség
```

**Solidity Jelentése:**
- **1.0:** Tökéletes téglalap (konvex)
- **0.9:** Kis bemélyedések
- **0.8:** Közepes bemélyedések (minimum küszöb)
- **< 0.8:** Nagy bemélyedések, nem téglalap

**E) Pontozási Rendszer:**

Minden kontúr pontszámot kap a validálás alapján:

```
score = 0

// Aspect Ratio (max 30 pont)
if (0.9 ≤ aspectRatio ≤ 1.1):     score += 30  // Tökéletes
elif (1.1 < aspectRatio ≤ 2.0):   score += 15  // Közepes

// Solidity (max 25 pont)
if (solidity > 0.95):             score += 25  // Magas
elif (solidity > 0.85):           score += 15  // Közepes
else:                             score += 5   // Alacsony

// Méret (max 20 pont)
if (areaRatio > 0.4):             score += 20  // Nagy
elif (areaRatio > 0.2):           score += 10  // Közepes

Total Score (max 75 pont)
```

**Legjobb Kontúr Kiválasztása:**
```
bestContour = null
maxScore = 0

for (contour in validContours) {
  if (contour.score > maxScore) {
    maxScore = contour.score
    bestContour = contour
  }
}
```

#### 7. Stabilitás Ellenőrzés (Anti-Jitter)

**Cél:** Villogás és ugrálás megelőzése a UI-ban.

**Állapotgép (State Machine):**
```
States:
  - NO_DETECTION (nincs dokumentum)
  - DETECTING (detektálás folyamatban)
  - STABLE (stabil detektálás)
  - FROZEN (befagyasztva, fotózás után)
```

**Átmenetek:**
```
NO_DETECTION
     ↓ (dokumentum talált)
DETECTING (számláló++)
     ↓ (5+ egymást követő frame)
STABLE ✓
     ↓ (fotó készítés)
FROZEN (15 frame)
     ↓
NO_DETECTION
```

**Stabil Detektálás Logika:**
```
consecutiveDetectionCount = 0
consecutiveNoDetectionCount = 0

Every Frame:
  if (dokumentum_detektálva) {
    consecutiveDetectionCount++
    consecutiveNoDetectionCount = 0
    
    if (consecutiveDetectionCount ≥ 5) {
      state = STABLE  // ✓ Stabil
    }
  } else {
    consecutiveNoDetectionCount++
    consecutiveDetectionCount = 0
    
    if (consecutiveNoDetectionCount ≥ 15) {
      state = NO_DETECTION
    }
  }
```

**Confidence Simítás (Smoothing):**
```
smoothedConfidence = 0.7 × previousConfidence + 
                     0.3 × currentConfidence

// Exponenciális mozgóátlag (EMA)
```

### Szkennelési Pipeline

A fotó készítésekor egy komplex 15 lépéses feldolgozási pipeline fut le:

#### 1. Fotó Készítése

```
Camera.takePhoto({
  flash: 'off',
  qualityPrioritization: 'quality',
  enableAutoStabilization: true
})
```

**Kimenet:**
- **Felbontás:** Max (pl. 3264×2448, 12MP)
- **Formátum:** JPEG
- **Orientáció:** Landscape (fekvő)

#### 2. Orientáció Fix (90° Forgatás)

**Probléma:** A kamera landscape módban készít fotót, de az app portrait módban fut.

```
Eredeti Fotó (landscape): 3264 × 2448
         ↓
rotate(src, dst, ROTATE_90_CLOCKWISE)
         ↓
Forgatott (portrait):     2448 × 3264
```

**OpenCV Kód:**
```
cv.rotate(photo, rotatedPhoto, cv.ROTATE_90_CLOCKWISE)
```

**Koordináta Transzformáció:**
```
Eredeti (x, y) → Forgatott (y, width - x)

Példa:
  (100, 200) @ 3264×2448
  → (200, 3264-100) = (200, 3164) @ 2448×3264
```

#### 3. Sarok Koordináták Skálázása

**Probléma:** A detektált sarkok frame koordinátákban vannak, de a fotó más felbontású.

```
Frame:  1080 × 608  (feldolgozási méret)
Photo:  3264 × 2448 (eredeti méret, forgatás előtt)

Skálázási faktorok:
  scaleX = photoWidth / frameWidth  = 3264 / 1080 ≈ 3.02
  scaleY = photoHeight / frameHeight = 2448 / 608  ≈ 4.03
```

**Transzformáció:**
```
for (corner in corners) {
  photoCorner.x = corner.x × scaleX
  photoCorner.y = corner.y × scaleY
}
```

**Példa:**
```
Frame corner: (500, 300)
Photo corner: (500 × 3.02, 300 × 4.03) = (1510, 1209)
```

#### 4. Perspective Transform (Perspektíva Korrekció)

**Cél:** A ferde fotót egyenes téglalapra alakítani.

**4 sarok → Téglalap:**
```
Input: 4 sarok (tetszőleges trapéz/négyszög)
  [topLeft, topRight, bottomRight, bottomLeft]

Output: Egyenes téglalap
  Width:  átlagos felső/alsó szélesség
  Height: átlagos bal/jobb magasság
```

**Szélesség/Magasság Számítás:**
```
topWidth = distance(topLeft, topRight)
bottomWidth = distance(bottomLeft, bottomRight)
width = (topWidth + bottomWidth) / 2

leftHeight = distance(topLeft, bottomLeft)
rightHeight = distance(topRight, bottomRight)  
height = (leftHeight + rightHeight) / 2
```

**Perspective Transformation Matrix:**
```
srcPoints = [topLeft, topRight, bottomRight, bottomLeft]
dstPoints = [(0,0), (width,0), (width,height), (0,height)]

M = getPerspectiveTransform(srcPoints, dstPoints)
warpedImage = warpPerspective(rotatedPhoto, M, (width, height))
```

**Vizuális Példa:**
```
Előtte (trapéz):          Utána (téglalap):
    ________                  ┌────────┐
   /        \                 │        │
  /          \                │        │
 /            \               │        │
/______________\              └────────┘
```

#### 5. Tükrözés & További Forgatás

```
warpedImage
    ↓
flip(HORIZONTAL)  // Vízszintes tükrözés
    ↓
rotate(ROTATE_180)  // 180° forgatás
    ↓
finalOrientation
```

**Miért szükséges?**
- Kamera mirror mode kompenzálása
- Helyes olvasási irány biztosítása

#### 6. Scaling (Opcionális)

```
if (SCALE_FACTOR ≠ 1.0) {
  newWidth = width × SCALE_FACTOR
  newHeight = height × SCALE_FACTOR
  
  resize(image, (newWidth, newHeight), INTER_LANCZOS4)
}
```

**Jelenleg:** SCALE_FACTOR = 1.0 (nincs skálázás)

#### 7. Brightness Detektálás & Auto-Adjustment

**Fényerő Mérés:**
```
grayscale = cvtColor(image, COLOR_BGR2GRAY)
{minVal, maxVal} = minMaxLoc(grayscale)

range = maxVal - minVal

if (range > 150):
  avgBrightness = minVal × 0.2 + maxVal × 0.8  // Világos kép
elif (range > 100):
  avgBrightness = minVal × 0.3 + maxVal × 0.7  // Normál
else:
  avgBrightness = (minVal + maxVal) / 2        // Sötét kép
```

**Beta Boost Számítás (Sötét Képekhez):**
```
rawBeta = (max(0, 230 - avgBrightness))^1.2 × 0.2
betaBoost = clamp(rawBeta, 0, 80)
```

**Példák:**
```
avgBrightness = 200 → betaBoost = 0    (világos, nincs boost)
avgBrightness = 150 → betaBoost = 18   (normál, kis boost)
avgBrightness = 80  → betaBoost = 45   (sötét, közepes boost)
avgBrightness = 30  → betaBoost = 80   (nagyon sötét, max boost)
```

**Fényerő Kategória:**
```
if (avgBrightness > 150): "Nappali"   (☀️)
elif (avgBrightness > 80): "Normál"   (🏙️)
else: "Éjjeli"                        (🌙)
```

#### 8-10. 3 Réteg Feldolgozás (Trilayer Processing)

**Filozófia:** Különböző elemek (szöveg, háttér, színek) külön optimalizálása.

**FEKETE RÉTEG (Szöveg Kiemelése):**
```
1. Grayscale konverzió
2. GaussianBlur (5×5)
3. Threshold (100):
     pixel < 100 → 0 (fekete)
     pixel ≥ 100 → 255 (fehér)
4. Bitwise NOT → Fekete szöveg, fehér háttér
5. Normalize (0.0 - 1.0 range)
```

**Eredmény:** Éles fekete szöveg

**FEHÉR RÉTEG (Háttér Tisztítása):**
```
1. Grayscale konverzió
2. GaussianBlur (5×5)
3. Threshold (127):
     pixel < 127 → 0 (fekete)
     pixel ≥ 127 → 255 (fehér)
4. Normalize (0.0 - 1.0 range)
```

**Eredmény:** Tiszta fehér háttér

**SZÍNES RÉTEG (Színes Elemek Megtartása):**
```
1. HSV konverzió
2. Saturation Channel kinyerése
3. GaussianBlur (3×3)
4. Threshold (50):
     saturation > 50 → színes
     saturation ≤ 50 → nem színes
5. MorphologyEx CLOSE (3×3)
6. Dilate (3×3)
7. Bitwise AND (original, colorMask)
8. Saturation Boost (×2.0):
     S_channel × 2.0 (clamped to 255)
9. Normalize (0.0 - 1.0 range)
```

**Eredmény:** Élénk, telített színek

**KOMBINÁCIÓ (Weighted Average):**
```
finalImage = blackLayer × 0.5 +     // 50% szöveg
             whiteLayer × 0.3 +     // 30% háttér
             colorLayer × 0.2       // 20% színek

// Denormalize vissza (0-255 range)
finalImage × 255
```

#### 11. Sharpening (Élesítés)

**Unsharp Mask Technika:**

```
1. GaussianBlur(5×5) → blurred
2. sharpened = original + SHARPEN_AMOUNT × (original - blurred)

ahol SHARPEN_AMOUNT = 1.8
```

**Matematikai Formula:**
```
sharpened(x,y) = original(x,y) + 1.8 × [original(x,y) - blurred(x,y)]
```

**Hatás:**
- Élek kiemelése
- Részletek felerősítése
- Kontrasztfokozás élek mentén

**Példa Pixel Értékekre:**
```
Eredeti: 100
Blurred: 90
Különbség: 10

Sharpened: 100 + 1.8 × 10 = 118  (élesebb)
```


#### 12. Saturation Boost (Színtelítettség Fokozás)

```
1. BGR → HSV konverzió
2. S channel kinyerése
3. S × SAT_BOOST (1.5)
4. Clamp (0-255)
5. HSV → BGR visszaalakítás
```

**Hatás:**
- Színek élénkebbé válnak
- Szürke árnyalatok változatlanok maradnak

#### 13. Brightness Boost

```
convertScaleAbs(image, 
  alpha = BRIGHTNESS_ALPHA,    // 1.2
  beta = betaBoost)            // 0-80 (dinamikus)
```

**Formula:**
```
boosted(x,y) = saturate(1.2 × original(x,y) + betaBoost)
```

**Hatás:**
- Általános világosítás (×1.2)
- Extra boost sötét képekhez (+betaBoost)

#### 14. Final Contrast Bump

```
convertScaleAbs(image,
  alpha = SCAN_CONTRAST_ALPHA,  // 1.3
  beta = SCAN_BRIGHTNESS_BETA)  // 5
```

**Formula:**
```
final(x,y) = saturate(1.3 × image(x,y) + 5)
```

**Hatás:**
- Kontraszt fokozás (×1.3)
- Minimális fényerő offset (+5)
- Professzionális scan megjelenés

#### 15. Ikon Detektálás (8 Szegmens Elemzése)

**Szegmentálás:**

```
borderHeight = finalImage.height × 0.04  // 4% magasság (ikon sáv)
borderROI = finalImage[bottom - borderHeight : bottom, :]

Teljes szélesség: width
Hasznos szélesség: width × 0.75 (75%)

Padding kiszámítása:
  centerPadding = width × 0.125  // 12.5% középre igazítás
  
  if (QR bal oldalt):
    leftPadding = centerPadding + 10
  else (QR jobb oldalt):
    fingerOffset = width × 0.04  // 4% ujj elkerülés
    leftPadding = centerPadding - fingerOffset - 10

borderWidth = width × 0.75
segmentWidth = borderWidth / 8  // 8 egyenlő szegmens
```

**Vizuális Layout:**
```
┌──────────────────────────────────────────┐
│         Dokumentum Tartalma (96%)        │
├──────────────────────────────────────────┤ ← borderTop
│   ┌────────────────────────────┐        │   (4% magasság)
│   │ 0 │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │    │   (8 szegmens)
│   └────────────────────────────┘        │   (75% szélesség)
│   ↑                                     │
│   leftPadding (QR alapján)              │
└──────────────────────────────────────────┘
```

**Szegmens Feldolgozás:**

```
selectedIcons = []

for (segmentIndex in 0..7) {
  // ROI kiszámítás
  x1 = leftPadding + segmentIndex × segmentWidth
  x2 = x1 + segmentWidth
  
  segmentROI = borderROI[:, x1:x2]
  
  // Grayscale konverzió
  gray = cvtColor(segmentROI, COLOR_BGR2GRAY)
  
  // Bináris threshold
  _, binary = threshold(gray, 100, 255, THRESH_BINARY)
  
  // Sötét pixel számolás
  darkPixels = countNonZero(binary == 0)
  totalPixels = segmentWidth × borderHeight
  
  darkPixelRatio = darkPixels / totalPixels
  
  // Detektálás (0.5% küszöb)
  if (darkPixelRatio >= 0.005) {
    selectedIcons.push(segmentIndex)
  }
}
```

**Ikon Nevek Hozzárendelése:**
```
ICON_NAMES = ['', 'nyíl', 'gyémánt', 'alma', 'csengő', 
              'lóhere', 'csillag', 'patkó']

selectedIconNames = selectedIcons.map(idx => ICON_NAMES[idx])
```

**Példa Eredmény:**
```
selectedIcons = [1, 3, 5]
selectedIconNames = ['nyíl', 'alma', 'lóhere']
```

**Piros Keret Rajzolás (Debug):**

```
Csak 1-7 szegmensekre (0. kihagyva)

for (segmentIndex in 1..7) {
  x1 = leftPadding + segmentIndex × segmentWidth
  x2 = x1 + segmentWidth
  y1 = borderTop
  y2 = borderTop + borderHeight
  
  // Keret vonalak
  line(image, (x1, y1), (x2, y1), RED, 6)     // Felső
  line(image, (x1, y2), (x2, y2), RED, 6)     // Alsó
  line(image, (x1, y1), (x1, y2), RED, 6)     // Bal
  line(image, (x2, y1), (x2, y2), RED, 6)     // Jobb
  
  // Szegmens választóvonal (2-7)
  if (segmentIndex >= 2) {
    line(image, (x1, y1), (x1, y2), RED, 3)
  }
}
```

**QR Alapú Pozícionálás Logika:**

```
// QR bounds (frame koordináták)
qrCenterX = qrBounds.left + qrBounds.width / 2
frameCenterX = frameWidth / 2

qrOnLeft = (qrCenterX < frameCenterX)

if (qrOnLeft) {
  // QR bal oldalt → Ikonok középre (jobb kéz pozíció)
  leftPadding = centerPadding + 10
  
} else {
  // QR jobb oldalt → Ikonok balrább (bal kéz, ujj elkerülés)
  fingerOffset = width × 0.04  // 4%
  leftPadding = centerPadding - fingerOffset - 10
}
```

**Dark Pixel Ratio Példák:**

```
Üres szegmens:
  darkPixels = 50 / 10000 = 0.005 (0.5%) → Küszöb határán
  
Ikon szegmens (nyíl):
  darkPixels = 800 / 10000 = 0.08 (8%) → Detektált ✓
  
Kicsi folt (zaj):
  darkPixels = 30 / 10000 = 0.003 (0.3%) → Nem detektált
```

---

## 📱 Rendszerkövetelmények

### iOS
- **Verzió**: iOS 13.0 vagy újabb
- **Eszközök**: iPhone 7 vagy újabb
- **Kamera**: Minimum 8MP

### Android
- **Verzió**: Android 6.0 (API 23) vagy újabb
- **Eszközök**: Mid-range vagy jobb
- **Kamera**: Minimum 8MP
- **RAM**: Minimum 2GB

---

## 🔒 Adatvédelem

- ✅ **Helyi feldolgozás**: Minden kép a telefonon kerül feldolgozásra
- ✅ **Nincs feltöltés**: Fotók nem kerülnek szerverre
- ✅ **Felhasználói kontroll**: Csak te döntöd el, mit osztasz meg
- ✅ **Nincs adatgyűjtés**: Az alkalmazás nem gyűjt személyes adatokat

---

## 📞 Támogatás

### Gyakori Kérdések (FAQ)

**K: Működik internet nélkül?**  
V: Igen! Az összes feldolgozás helyben történik.

**K: Hány füzet oldalt tudok szkennelni?**  
V: Nincs limit, a telefonod tárhelyétől függ.

**K: Mi a maximum fotó felbontás?**  
V: A telefonod kamerájának maximumát használja.

**K: Támogatja a tablet-eket?**  
V: Igen, bármely iOS/Android eszközt.

---

## 🆕 Verziótörténet

### v1.0.0 (2025.01.07)
- ✨ Automatikus dokumentum detektálás
- ✨ QR kód pozícionálás
- ✨ Professzionális szkennelés
- ✨ Ikon detektálás (7 ikon)
- ✨ Megosztás funkció
- ✨ Villanó támogatás
- ✨ Tap-to-focus

---

## 🏆 Készítette

**BERRĪ Team**  
Marton Szabolcs - Lead Developer

---

**Élvezd a szkennelést! 📸✨**
