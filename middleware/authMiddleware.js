function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/");
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/");
  }

  if ((req.session.userRole || "").toLowerCase() !== "admin") {
    return res.status(403).send("Access denied. Admins only.");
  }

  next();
}

module.exports = {
  requireLogin,
  requireAdmin
};