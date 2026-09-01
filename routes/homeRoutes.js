const express = require("express");
const path = require("path");
const fs = require("fs");

const { requireLogin, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

function renderHome(req, res, startView) {
  const userName = req.session.userName || "User";
  const isAdmin = (req.session.userRole || "").toLowerCase() === "admin";

  const adminLink = isAdmin
    ? '<a href="/admin/policies" class="admin-link">⚙ Policies</a>'
    : "";

  const filePath = path.join(__dirname, "..", "public", "home.html");

  let page = fs.readFileSync(filePath, "utf8");

  page = page.replace(
    "window.AI_ASSISTANT_USER = 'Guest';",
    `window.AI_ASSISTANT_USER = ${JSON.stringify(userName)};`
  );

  page = page.replace("<!--ADMIN_LINK-->", adminLink);

  page = page.replace(
    '<body class="home-body">',
    `<body class="home-body"><script>window.START_VIEW = ${JSON.stringify(startView)};</script>`
  );

  res.type("html").send(page);
}

router.get("/home", requireLogin, (req, res) => {
  try {
    renderHome(req, res, "home");
  } catch (err) {
    console.error("Home route error", err);
    res.status(500).send("Server error");
  }
});

router.get("/emi", requireLogin, (req, res) => {
  try {
    renderHome(req, res, "emi");
  } catch (err) {
    console.error("EMI route error", err);
    res.status(500).send("Server error");
  }
});

router.get("/admin/policies", requireAdmin, (req, res) => {
  try {
    renderHome(req, res, "policy");
  } catch (err) {
    console.error("Admin policies route error", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;