const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const initSqlJs = require("sql.js");

const app = express();
const PORT = 3000;

const TEST_USER = { email: "foo", password: "foo" };

// -----------------------------------------------------------------------
// 2. DATABASE NEREDE OLUŞTURULUYOR:
//    DB_PATH ile isimler.db dosyasının yolu belirlenir.
//    Dosya varsa okunur, yoksa yeni boş veritabanı oluşturulur.
// -----------------------------------------------------------------------
const DB_PATH = path.join(__dirname, "isimler.db");

function saveDb(db) {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function getAllNames(db) {
  const result = db.exec("SELECT * FROM isimler ORDER BY id");
  if (!result.length) return [];
  return result[0].values.map(([id, isim]) => ({ id, isim }));
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: "odev5-secret",
  resave: false,
  saveUninitialized: false,
}));

function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/login");
}

// Login sayfası
app.get("/login", (req, res) => {
  if (req.session.loggedIn) return res.redirect("/");
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (email === TEST_USER.email && password === TEST_USER.password) {
    req.session.loggedIn = true;
    return res.redirect("/");
  }
  res.render("login", { error: "E-posta veya şifre hatalı." });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// sql.js başlatma async; sunucu hazır olunca dinlemeye başlar
initSqlJs().then((SQL) => {
  const db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  // -----------------------------------------------------------------------
  // 3. TABLO NEREDE OLUŞTURULUYOR:
  //    db.run ile CREATE TABLE komutu çalıştırılır.
  //
  // 4. MEVCUT TABLONUN VARLIĞI NEREDE KONTROL EDİLİYOR:
  //    "IF NOT EXISTS" ifadesi sayesinde tablo zaten varsa tekrar oluşturulmaz,
  //    böylece önceki kayıtlar silinmez.
  // -----------------------------------------------------------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS isimler (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      isim TEXT    NOT NULL UNIQUE
    )
  `);
  saveDb(db);

  // -----------------------------------------------------------------------
  // READ: Ana sayfa - tüm isimleri veritabanından oku ve listele
  // -----------------------------------------------------------------------
  app.get("/", requireLogin, (req, res) => {
    res.render("index", { names: getAllNames(db) });
  });

  // -----------------------------------------------------------------------
  // CREATE: Yeni isim ekle
  //    INSERT INTO komutu ile yeni kayıt veritabanına eklenir
  // -----------------------------------------------------------------------
  app.post("/add", requireLogin, (req, res) => {
    const newName = req.body.name ? req.body.name.trim() : "";
    if (!newName) return res.redirect("/");
    try {
      db.run("INSERT INTO isimler (isim) VALUES (?)", [newName]);
      saveDb(db);
    } catch (_) {
      // Duplicate isim - UNIQUE kısıtı ihlali, sessizce geç
    }
    res.redirect("/");
  });

  // Güncelleme formu - mevcut ismi göster
  app.get("/edit/:id", requireLogin, (req, res) => {
    const id = Number(req.params.id);
    const row = getAllNames(db).find((n) => n.id === id);
    if (!row) return res.redirect("/");
    res.render("edit", { name: row.isim, id: row.id });
  });

  // -----------------------------------------------------------------------
  // UPDATE: İsmi güncelle
  //    UPDATE komutu ile mevcut kayıt veritabanında güncellenir
  // -----------------------------------------------------------------------
  app.post("/update/:id", requireLogin, (req, res) => {
    const updatedName = req.body.name ? req.body.name.trim() : "";
    const id = Number(req.params.id);
    if (!updatedName) return res.redirect(`/edit/${id}`);
    try {
      db.run("UPDATE isimler SET isim = ? WHERE id = ?", [updatedName, id]);
      saveDb(db);
    } catch (_) {
      // Duplicate isim - sessizce geç
    }
    res.redirect("/");
  });

  // -----------------------------------------------------------------------
  // DELETE: İsmi sil
  //    DELETE FROM komutu ile kayıt veritabanından silinir
  // -----------------------------------------------------------------------
  app.post("/delete/:id", requireLogin, (req, res) => {
    db.run("DELETE FROM isimler WHERE id = ?", [Number(req.params.id)]);
    saveDb(db);
    res.redirect("/");
  });

  app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
  });
});
