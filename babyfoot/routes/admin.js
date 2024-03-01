var express = require("express");
var router = express.Router();
var crypto = require("crypto");

const isAdmin = require("../middleware/checkAdmin.js");
router.use(isAdmin);

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ******************************************************************************
// Route qui gère l'affichage de la page d'admin.
// ******************************************************************************

router.get("/", async (req, res) => {
  const allUsers = await prisma.utilisateurs.findMany({});
  const allBabyfoots = await prisma.babyfoot.findMany({});

  const currentGames = await prisma.parties.findMany({
    include: {
      babyfoot: true,
    },
    where: {
      etat: "en cours",
    },
  });

  res.render("admin", { users: allUsers, babyfoots: allBabyfoots, games: currentGames });
});

module.exports = router;
