var express = require("express");
var router = express.Router();
var crypto = require("crypto");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ******************************************************************************
// Route de la page principale
// Envoie les joueurs, les babyfoots et les parties en cours
// ******************************************************************************

router.get("/", async (req, res) => {
  if (req.session.admin) {
    return res.redirect("admin/");
  }
  if (req.session.loggedin == true) {
    const games = await prisma.parties.findMany({
      include: {
        babyfoot: true,
        adversaire_1: true,
        adversaire_2: true,
      },
      where: {
        etat: "en cours",
      },
    });
    const babyfoot = await prisma.babyfoot.findMany({
      include: {
        parties: {
          where: {
            etat: "en cours",
          },
        },
      },
    });
    const players = await prisma.utilisateurs.findMany({
      include: {
        partiesAdv1: {
          where: {
            etat: "en cours",
          },
        },
        partiesAdv2: {
          where: {
            etat: "en cours",
          },
        },
      },
    });

    return res.render("index", { user: req.session.username, players: players, babyfoots: babyfoot, games: games });
  } else {
    return res.render("login");
  }
});

// ******************************************************************************
// Routes login, nouvel utilisateur et oublie de mot de passe
// ******************************************************************************

router.get("/login", function (req, res) {
  res.render("login", { error: req.session.error });
});

router.get("/register", function (req, res) {
  res.render("register", { error: req.session.error });
});

router.get("/forgot", function (req, res) {
  res.render("forgot", { error: req.session.error });
});

// ******************************************************************************
// Lorsque l'utilisateur clic sur le bouton pour réinitialiser son mot de passe,
// cette page génère un token aléatoire et le stock dans la base de données.
// On envoie le lien avec le token par mail à l'utilisateur en question.
// ******************************************************************************

router.post("/reset", async (req, res) => {
  const { mail } = req.body;

  // Generate a random token
  const buf = crypto.randomBytes(10);
  console.log("The random data is: " + buf.toString("base64"));

  const now = new Date().toISOString();

  const result = await prisma.utilisateurs.update({
    where: {
      mail: mail,
    },
    data: {
      pwdtoken: buf.toString("base64"),
      timestamp: now,
    },
  });

  // Send email with URL
  res.send("http://localhost:8080/reset/" + buf.toString("base64"));
});

// ******************************************************************************
// Route qui gère la page de réinitialisation du mot de passe, en vérifiant
// que le token est toujours valable.
// ******************************************************************************

router.get("/reset/:token", async (req, res) => {
  const { token } = req.params;

  // Find the user with the corresponding token
  const result = await prisma.utilisateurs.findFirst({
    where: {
      pwdtoken: token,
    },
  });

  const now = Date.now();
  const tokenCreation = Date.parse(result.timestamp);

  // Check if token is still valid (10 minutes)
  if (now - tokenCreation > 600000) {
    req.session.error = "Token has timed out.";
    res.redirect("/forgot");
  } else {
    res.render("reset", { user: result });
  }
});

// ******************************************************************************
// Route qui gère l'enregistrement du nouveau mot de passe dans la base.
// ******************************************************************************

router.post("/reset_password", async (req, res) => {
  const { password, id } = req.body;

  // Hash password and update it
  var salt = "babyfoot";
  var hash = crypto.pbkdf2Sync(password, salt, 1000, 64, `sha512`).toString(`base64`);

  const result = await prisma.utilisateurs.update({
    where: {
      id: Number(id),
    },
    data: {
      pwd: hash,
    },
  });
  res.redirect("/login");
});

// ******************************************************************************
// Route qui gère l'authentification de l'utilisateur.
// ******************************************************************************

router.post("/auth", async function (req, res) {
  let username = req.body.username;
  let password = req.body.password;

  // Ensure the input fields exists and are not empty
  if (username && password) {
    // Hash the password to check it against the hash in the database
    var salt = "babyfoot";
    var hash = crypto.pbkdf2Sync(password, salt, 1000, 64, `sha512`).toString(`base64`);

    const user = await prisma.utilisateurs.findUnique({
      where: { nom: username, pwd: hash },
    });

    if (user) {
      req.session.loggedin = true;
      req.session.username = username;
      req.session.admin = false;

      if (user.role == "admin") {
        req.session.admin = true;
      }

      res.redirect("/");
    } else {
      req.session.error = "Wrong user/password";
      res.redirect("/");
    }
  } else {
    req.session.error = "At least one field is empty.";
    res.redirect("/login");
  }
});

// ******************************************************************************
// Route qui gère la déconnexion de l'utilisateur.
// ******************************************************************************

router.get("/logout", function (req, res, next) {
  req.session.username = null;
  req.session.save(function (err) {
    if (err) next(err);

    // regenerate the session, which is good practice to help
    // guard against forms of session fixation
    req.session.regenerate(function (err) {
      if (err) next(err);
      res.redirect("/");
    });
  });
});

module.exports = router;
