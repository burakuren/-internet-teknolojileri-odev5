const express = require("express");
const path = require("path");
// better-sqlite3: senkron SQLite3 API
const Database = require("better-sqlite3");

const app = express();
const PORT = 3000;

// -----------------------------------------------------------------------
// 2. DATABASE NEREDE OLUŞTURULUYOR:
//    Aşağıdaki satır isimler.db dosyasını oluşturur (yoksa) veya açar (varsa).
//    DatabaseSync, dosya yoksa otomatik olarak oluşturur.
// -----------------------------------------------------------------------
const db = new Database(path.join(__dirname, "isimler.db"));

// -----------------------------------------------------------------------
// 3. TABLO NEREDE OLUŞTURULUYOR:
//    CREATE TABLE komutu ile "isimler" tablosu oluşturuluyor.
//
// 4. MEVCUT TABLONUN VARLIĞI NEREDE KONTROL EDİLİYOR:
//    "IF NOT EXISTS" ifadesi sayesinde tablo zaten varsa tekrar oluşturulmaz,
//    böylece önceki kayıtlar silinmez.
// -----------------------------------------------------------------------
db.prepare(`
  CREATE TABLE IF NOT EXISTS isimler (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    isim TEXT    NOT NULL UNIQUE
  )
`).run();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// -----------------------------------------------------------------------
// READ: Ana sayfa - tüm isimleri veritabanından oku ve listele
// -----------------------------------------------------------------------
app.get("/", (req, res) => {
  const names = db.prepare("SELECT * FROM isimler ORDER BY id").all();
  res.render("index", { names });
});

// -----------------------------------------------------------------------
// CREATE: Yeni isim ekle
//    INSERT INTO komutu ile yeni kayıt veritabanına eklenir
// -----------------------------------------------------------------------
app.post("/add", (req, res) => {
  const newName = req.body.name ? req.body.name.trim() : "";

  if (!newName) {
    return res.redirect("/");
  }

  // Aynı isim varsa UNIQUE kısıtı hata fırlatır; try/catch ile yakalanıyor
  try {
    db.prepare("INSERT INTO isimler (isim) VALUES (?)").run(newName);
  } catch (_) {
    // Duplicate isim - sessizce geç
  }

  res.redirect("/");
});

// Güncelleme formu - mevcut ismi göster
app.get("/edit/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM isimler WHERE id = ?").get(req.params.id);

  if (!row) {
    return res.redirect("/");
  }

  res.render("edit", { name: row.isim, id: row.id });
});

// -----------------------------------------------------------------------
// UPDATE: İsmi güncelle
//    UPDATE komutu ile mevcut kayıt veritabanında güncellenir
// -----------------------------------------------------------------------
app.post("/update/:id", (req, res) => {
  const updatedName = req.body.name ? req.body.name.trim() : "";
  const id = req.params.id;

  if (!updatedName) {
    return res.redirect(`/edit/${id}`);
  }

  try {
    db.prepare("UPDATE isimler SET isim = ? WHERE id = ?").run(updatedName, id);
  } catch (_) {
    // Duplicate isim - sessizce geç
  }

  res.redirect("/");
});

// -----------------------------------------------------------------------
// DELETE: İsmi sil
//    DELETE FROM komutu ile kayıt veritabanından silinir
// -----------------------------------------------------------------------
app.post("/delete/:id", (req, res) => {
  db.prepare("DELETE FROM isimler WHERE id = ?").run(req.params.id);
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});
