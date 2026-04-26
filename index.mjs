import express from "express";
import mysql from "mysql2/promise";
import 'dotenv/config';
import session from "express-session";

const bcrypt = (await import('bcrypt')).default;

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

//for Express to get values using the POST method
app.use(express.urlencoded({extended:true}));

//setting up database connection pool, replace values in red
const pool = mysql.createPool({
    host: "co28d739i4m2sb7j.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    database: "dfb76gw2s7akyxmg",
    connectionLimit: 10,
    waitForConnections: true
});

//routes
app.get("/", async (req, res) => { 
    res.render("login.ejs");
});

app.post("/loginProcess", async (req, res) => {
    let {username, password} = req.body;

    let sql = `SELECT *
               FROM admin
               WHERE username = ?`
    const [rows] = await pool.query(sql, [username]);

    let hashedPassword = "";

    // username was found in db
    if (rows.length > 0) {
        hashedPassword = rows[0].password;
    }

    const match = await bcrypt.compare(password, hashedPassword);

    if (match) {
        req.session.authenticated = true;
        res.redirect("home");
    } else {
        let loginError = "Invalid username or password, please try again.";
        res.render("login.ejs", {loginError});
    }
});

app.get("/home", isUserAuthenticated, (req, res) => {
    res.render("home.ejs");
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

app.get("/addAuthor", isUserAuthenticated, (req, res) => {
    res.render("addAuthor.ejs");
});

app.post("/addAuthor", isUserAuthenticated, async (req, res) => {
    let firstName = req.body.firstName;
    let lastName = req.body.lastName;
    let country = req.body.country;
    let profession = req.body.profession;
    let dob = req.body.dob;
    let dod = req.body.dod;
    let bio = req.body.bio;
    let sex = req.body.sex;
    let portrait = req.body.portrait;

    let sql = `INSERT INTO authors
               (firstName, lastName, country, profession, dob, dod, biography, sex, portrait)
               VALUES
               (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    let sqlParams = [firstName, lastName, country, profession, dob, dod, bio, sex, portrait];

    await pool.query(sql, sqlParams);

    res.redirect("/");
});

app.get("/addQuote", isUserAuthenticated, async (req, res) => {
    const [authors] = await pool.query(`SELECT authorId, CONCAT(firstName, ' ', lastName) AS name 
                                        FROM authors
                                        ORDER BY lastName, firstName`);
    const [categories] = await pool.query(`SELECT DISTINCT category 
                                           FROM quotes 
                                           ORDER BY category`);

    res.render("addQuote.ejs", {authors, categories});
});

app.post("/addQuote", isUserAuthenticated, async (req, res) => {
    let quote = req.body.quote;
    let authorId = req.body.authorId;
    let category = req.body.category;
    let likes = req.body.likes;

    let sql = `INSERT INTO quotes
               (quote, authorId, category, likes)
               VALUES
               (?, ?, ?, ?)`
    let sqlParams = [quote, authorId, category, likes];

    await pool.query(sql, sqlParams);

    res.redirect("/");
});

app.get("/authors", isUserAuthenticated, async (req, res) => {
    const [authors] = await pool.query(`SELECT authorId, CONCAT(firstName, ' ', lastName) AS name 
                                        FROM authors
                                        ORDER BY authorId`);
    res.render("authors.ejs", {authors});
});

app.get("/editAuthor", isUserAuthenticated, async (req, res) => {
    let authorId = req.query.authorId;
    let sql = `SELECT *, DATE_FORMAT(dob, '%Y-%m-%d') AS ISOdob, DATE_FORMAT(dod, '%Y-%m-%d') AS ISOdod
               FROM authors
               WHERE authorId = ?`
    let sqlParams = [authorId];
    const [author] = await pool.query(sql, sqlParams);
    res.render("editAuthor.ejs", {author});
});

app.get("/deleteAuthor", isUserAuthenticated, async (req, res) => {
    let authorId = req.query.authorId;
    let sql = `DELETE 
               FROM authors
               WHERE authorId = ?`
    let sqlParams = [authorId];
    await pool.query(sql, sqlParams);
    res.redirect("authors");
});

app.post("/updateAuthor", isUserAuthenticated, async (req, res) => {
    let authorId = req.body.authorId;
    let firstName = req.body.firstName;
    let lastName = req.body.lastName;
    let country = req.body.country;
    let profession = req.body.profession;
    let dob = req.body.dob;
    let dod = req.body.dod;
    let bio = req.body.bio;
    let sex = req.body.sex;
    let portrait = req.body.portrait;

    let sql = `UPDATE authors
               SET firstName = ?,
                   lastName = ?,
                   country = ?,
                   profession = ?,
                   dob = ?,
                   dod = ?,
                   biography = ?,
                   sex = ?,
                   portrait = ?
               WHERE authorId = ?`
    let sqlParams = [firstName, lastName, country, profession, dob, dod, bio, sex, portrait, authorId];

    await pool.query(sql, sqlParams);

    res.redirect("/authors");
});

app.get("/quotes", isUserAuthenticated, async (req, res) => {
    const [quotes] = await pool.query(`SELECT quoteId, quote
                                       FROM quotes
                                       ORDER BY quoteId`);
    res.render("quotes.ejs", {quotes});
});

app.get("/editQuote", isUserAuthenticated, async (req, res) => {
    let quoteId = req.query.quoteId;
    let sql = `SELECT 
                 q.quoteId, 
                 q.category, 
                 q.likes, 
                 q.quote, 
                 q.authorId, 
                 CONCAT(a.firstName, ' ', a.lastName) AS authorName
               FROM quotes q
               JOIN authors a ON q.authorId = a.authorId
               WHERE quoteId = ?`
    let sqlParams = [quoteId];
    const [authors] = await pool.query(`SELECT authorId, CONCAT(firstName, ' ', lastName) AS name 
                                        FROM authors
                                        ORDER BY lastName, firstName`);
    const [categories] = await pool.query(`SELECT DISTINCT category 
                                           FROM quotes 
                                           ORDER BY category`);
    const [quote] = await pool.query(sql, sqlParams);
    res.render("editQuote.ejs", {quote, authors, categories});
});

app.post("/updateQuote", isUserAuthenticated, async (req, res) => {
    let quote = req.body.quote;
    let authorId = req.body.authorId;
    let category = req.body.category;
    let likes = req.body.likes;
    let quoteId = req.body.quoteId;

    let sql = `UPDATE quotes
               SET quote = ?,
                   authorId = ?,
                   category = ?,
                   likes = ?
               WHERE quoteId = ?`
    let sqlParams = [quote, authorId, category, likes, quoteId];

    await pool.query(sql, sqlParams);

    res.redirect("/quotes");
});

app.get("/deleteQuote", isUserAuthenticated, async (req, res) => {
    let quoteId = req.query.quoteId;
    let sql = `DELETE 
               FROM quotes
               WHERE quoteId = ?`
    let sqlParams = [quoteId];
    await pool.query(sql, sqlParams);
    res.redirect("quotes");
});

// middleware functions
function isUserAuthenticated(req, res, next) {
    if (req.session.authenticated) {
        next();
    } else {
        res.redirect("/");
    }
}

app.get("/dbTest", async(req, res) => {
   try {
        let sql = "SELECT CURDATE()"
        const [rows] = await pool.query(sql);
        res.send(rows);
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).send("Database error!");
    }
}); //dbTest

app.listen(3000, ()=>{
    console.log("Express server running")
});
