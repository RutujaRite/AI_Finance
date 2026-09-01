const userRepository = require("../repositories/userRepository");

async function login(req, res) {
  const { email, password } = req.body;

  try {
    const user = await userRepository.findByEmailAndPassword(
      email,
      password
    );

    if (user) {
      req.session.userId = user.id;
      req.session.userName = user.name || email.split("@")[0];
      req.session.userEmail = user.email;
      req.session.userRole = user.role || "user";

      try {
        await userRepository.updateLastLogin(user.id);
      } catch (err) {
        console.error("Failed to update last_login:", err);
      }

      return res.redirect("/home");
    }

    return res.send(`
      <div style="font-family:Arial;text-align:center;margin-top:100px">
        <h1>Login Failed!</h1>
        <p>Invalid email or password.</p>
        <a href="/">Try Again</a>
        <span> or </span>
        <a href="/register">Sign Up</a>
      </div>
    `);
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).send("Login failed. Please try again.");
  }
}
async function register(req, res) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const existingUser = await userRepository.findByEmail(email);

    if (existingUser) {
      return res.send(`
        <div style="font-family:Arial;text-align:center;margin-top:100px">
          <h1>User Already Exists!</h1>
          <p>This email is already registered.</p>
          <a href="/register">Try Again</a>
        </div>
      `);
    }

    await userRepository.createUser(name, email, password);

    return res.send(`
      <div style="font-family:Arial;text-align:center;margin-top:100px">
        <h1>Registration Successful!</h1>
        <p>Account created for ${name}.</p>
        <a href="/">Login Now</a>
      </div>
    `);
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).send("Registration failed. Please try again.");
  }
}
function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      return res.send("Logout failed");
    }

    res.clearCookie("connect.sid");
    res.redirect("/");
  });
}
module.exports = {
  login,
  register,
  logout
};