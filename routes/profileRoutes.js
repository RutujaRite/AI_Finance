const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const pool = require("../db");
const { requireLogin } = require("../middleware/authMiddleware");

const router = express.Router();

const profilePhotoDirectory = path.join(
  __dirname,
  "..",
  "public",
  "uploads",
  "profile-photos"
);

const profilePhotoUrlPrefix = "/uploads/profile-photos/";
const maxProfilePhotoBytes = 3 * 1024 * 1024;

function hasValidImageSignature(buffer, mimeType) {
  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (mimeType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(
          Buffer.from([
            0x89,
            0x50,
            0x4e,
            0x47,
            0x0d,
            0x0a,
            0x1a,
            0x0a
          ])
        )
    );
  }

  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString() === "RIFF" &&
      buffer.subarray(8, 12).toString() === "WEBP"
    );
  }

  return false;
}

router.get("/profile", requireLogin, (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "public", "profile.html")
  );
});

router.get("/api/profile", requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    const result = await pool.query(
      `SELECT
        id,
        name,
        email,
        mobile,
        dob,
        gender,
        address,
        city,
        pincode,
        occupation,
        employment_type,
        monthly_income,
        marital_status,
        residence_type,
        pan,
        aadhar,
        status,
        role,
        last_login,
        profile_photo_path
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    const user = result.rows[0];

    const dobVal = user.dob
      ? user.dob instanceof Date
        ? user.dob.toISOString().slice(0, 10)
        : String(user.dob).slice(0, 10)
      : "";

    const lastLogin = user.last_login
      ? new Date(user.last_login).toLocaleString()
      : "Never";

    const profilePhotoUrl =
      typeof user.profile_photo_path === "string" &&
      /^\/uploads\/profile-photos\/[a-zA-Z0-9.-]+$/.test(
        user.profile_photo_path
      )
        ? user.profile_photo_path
        : "";

    return res.json({
      id: user.id,
      name: user.name || "",
      email: user.email || "",
      mobile: user.mobile || "",
      dob: dobVal,
      gender: user.gender || "",
      address: user.address || "",
      city: user.city || "",
      pincode: user.pincode || "",
      occupation: user.occupation || "",
      employment_type: user.employment_type || "",
      monthly_income: user.monthly_income || "",
      marital_status: user.marital_status || "",
      residence_type: user.residence_type || "",
      pan: user.pan || "",
      aadhar: user.aadhar || "",
      status: user.status || "",
      role: user.role || "User",
      last_login_display: lastLogin,
      profile_photo_path: profilePhotoUrl
    });
  } catch (err) {
    console.error("Profile API error:", err);

    return res.status(500).json({
      error: "Server error"
    });
  }
});

router.post("/profile/update", requireLogin, async (req, res) => {
  const userId = req.session.userId;

  const {
    name,
    email,
    mobile,
    dob,
    gender,
    address,
    city,
    pincode,
    occupation,
    employment_type,
    monthly_income,
    marital_status,
    residence_type,
    pan,
    aadhar
  } = req.body;

  try {
    await pool.query(
      `UPDATE users
       SET
         name=$1,
         email=$2,
         mobile=$3,
         dob=$4,
         gender=$5,
         address=$6,
         city=$7,
         pincode=$8,
         occupation=$9,
         employment_type=$10,
         monthly_income=$11,
         marital_status=$12,
         residence_type=$13,
         pan=$14,
         aadhar=$15
       WHERE id=$16`,
      [
        name || null,
        email || null,
        mobile || null,
        dob || null,
        gender || null,
        address || null,
        city || null,
        pincode || null,
        occupation || null,
        employment_type || null,
        monthly_income || null,
        marital_status || null,
        residence_type || null,
        pan || null,
        aadhar || null,
        userId
      ]
    );

    req.session.userName = name || req.session.userName;
    req.session.userEmail = email || req.session.userEmail;

    return res.json({
      success: true
    });
  } catch (err) {
    console.error("Profile update error:", err);

    return res.json({
      success: false,
      error: "Update failed"
    });
  }
});

router.post("/profile/photo", requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const imageData = req.body && req.body.image;

  const match =
    typeof imageData === "string"
      ? imageData.match(
          /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/
        )
      : null;

  if (!match) {
    return res.status(400).json({
      success: false,
      error: "Use a JPG, PNG, or WebP image."
    });
  }

  const mimeType = match[1];

  const imageBuffer = Buffer.from(
    match[2].replace(/\s/g, ""),
    "base64"
  );

  if (
    !imageBuffer.length ||
    imageBuffer.length > maxProfilePhotoBytes ||
    !hasValidImageSignature(imageBuffer, mimeType)
  ) {
    return res.status(400).json({
      success: false,
      error: "The selected image is invalid or exceeds 3 MB."
    });
  }

  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  }[mimeType];

  const fileName =
    `${userId}-${crypto.randomBytes(20).toString("hex")}.${extension}`;

  const filePath = path.join(
    profilePhotoDirectory,
    fileName
  );

  const publicPath =
    `${profilePhotoUrlPrefix}${fileName}`;

  try {
    await fs.promises.mkdir(
      profilePhotoDirectory,
      { recursive: true }
    );

    const existing = await pool.query(
      `SELECT profile_photo_path
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: "User account was not found."
      });
    }

    const currentPath =
      typeof existing.rows[0].profile_photo_path === "string"
        ? existing.rows[0].profile_photo_path
        : "";

    if (
      currentPath &&
      currentPath.startsWith(profilePhotoUrlPrefix)
    ) {
      const currentFile = path.join(
        __dirname,
        "..",
        "public",
        currentPath.replace(/^\//, "")
      );

      await fs.promises
        .unlink(currentFile)
        .catch(() => {});
    }

    await fs.promises.writeFile(
      filePath,
      imageBuffer,
      {
        flag: "wx",
        mode: 0o600
      }
    );

    const update = await pool.query(
      `UPDATE users
       SET profile_photo_path = $1
       WHERE id = $2`,
      [publicPath, userId]
    );

    if (update.rowCount !== 1) {
      await fs.promises
        .unlink(filePath)
        .catch(() => {});

      return res.status(404).json({
        success: false,
        error: "User account was not found."
      });
    }

    return res.json({
      success: true,
      photoPath: publicPath
    });
  } catch (err) {
    console.error(
      "Profile photo upload error",
      err
    );

    await fs.promises
      .unlink(filePath)
      .catch(() => {});

    return res.status(500).json({
      success: false,
      error: "Could not save the profile photo."
    });
  }
});

router.delete("/profile/photo", requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    const result = await pool.query(
      `SELECT profile_photo_path
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: "User account was not found."
      });
    }

    const currentPath =
      result.rows[0].profile_photo_path;

    if (
      currentPath &&
      currentPath.startsWith(profilePhotoUrlPrefix)
    ) {
      const fileName =
        currentPath.replace(
          profilePhotoUrlPrefix,
          ""
        );

      const filePath = path.join(
        profilePhotoDirectory,
        fileName
      );

      await fs.promises
        .unlink(filePath)
        .catch(() => {});
    }

    await pool.query(
      `UPDATE users
       SET profile_photo_path = NULL
       WHERE id = $1`,
      [userId]
    );

    return res.json({
      success: true
    });
  } catch (err) {
    console.error(
      "Profile photo delete error",
      err
    );

    return res.status(500).json({
      success: false,
      error: "Could not delete the profile photo."
    });
  }
});

router.post(
  "/profile/change-password",
  requireLogin,
  async (req, res) => {
    const userId = req.session.userId;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 4) {
      return res.json({
        success: false,
        error: "Invalid password"
      });
    }

    try {
      await pool.query(
        `UPDATE users
         SET password = $1
         WHERE id = $2`,
        [newPassword, userId]
      );

      return res.json({
        success: true
      });
    } catch (err) {
      console.error(
        "Change password error",
        err
      );

      return res.json({
        success: false,
        error: "Change failed"
      });
    }
  }
);

module.exports = router;