const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const pool = require("./db");

const app = express();
const PORT = 3000;
const profilePhotoDirectory = path.join(__dirname, "public", "uploads", "profile-photos");
const profilePhotoUrlPrefix = "/uploads/profile-photos/";
const maxProfilePhotoBytes = 3 * 1024 * 1024;

function hasValidImageSignature(buffer, mimeType) {
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  return false;
}

async function initializeDatabase() {
  const client = await pool.connect();

  try {
    await fs.promises.mkdir(profilePhotoDirectory, { recursive: true });

    // Core users table (create if missing)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);

    // Add optional profile columns safely (won't drop any data)
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS mobile VARCHAR(30),
      ADD COLUMN IF NOT EXISTS dob DATE,
      ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS city VARCHAR(100),
      ADD COLUMN IF NOT EXISTS pincode VARCHAR(20),
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
      ADD COLUMN IF NOT EXISTS occupation VARCHAR(100),
      ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS monthly_income NUMERIC,
      ADD COLUMN IF NOT EXISTS marital_status VARCHAR(30),
      ADD COLUMN IF NOT EXISTS residence_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS pan VARCHAR(20),
      ADD COLUMN IF NOT EXISTS aadhar VARCHAR(30),
      ADD COLUMN IF NOT EXISTS profile_photo_path VARCHAR(255);
    `);

    // Table to save EMI calculations per user
    await client.query(`
      CREATE TABLE IF NOT EXISTS emi_calculations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        loan_type VARCHAR(100),
        loan_amount NUMERIC,
        annual_rate NUMERIC,
        processing_fee_percent NUMERIC,
        term_months INTEGER,
        months_or_years VARCHAR(10),
        monthly_emi NUMERIC,
        total_interest NUMERIC,
        total_payment NUMERIC,
        processing_fee_amount NUMERIC,
        schedule JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const existingAdmin = await client.query(
      "SELECT * FROM users WHERE email = $1",
      ["admin@gmail.com"]
    );

    if (existingAdmin.rowCount === 0) {
      await client.query(
        "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
        ["Admin", "admin@gmail.com", "1234"]
      );
    }
  } finally {
    client.release();
  }
}

app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login Page</title>
      <link rel="stylesheet" href="style.css">
    </head>
    <body>
      <div class="login-card">
        <h1>Welcome</h1>
        <p class="subtitle">Please login to continue</p>

        <form action="/login" method="POST">
          <label>Email</label>
          <input type="email" name="email" placeholder="Enter email" required>

          <label>Password</label>
          <input type="password" name="password" placeholder="Enter password" required>

          <button type="submit">Login</button>
        </form>

        <p class="demo" style="margin-top:24px;font-size:13px;color:#94a3b8;text-align:center;">
          Demo: admin@gmail.com / 1234
        </p>

        <p class="signup-text">
          Don't have an account?
          <a href="/register" class="signup-link">Sign Up</a>
        </p>
      </div>
    </body>
    </html>
  `);
});

// Middleware to check if user is logged in
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/");
  }
  next();
}

app.get("/home", requireLogin, (req, res) => {
  const userName = req.session.userName || "Guest";
  const userEmail = req.session.userEmail || "user@example.com";
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Home</title>
      <link rel="stylesheet" href="style.css" />
      <style>
        .welcome-section {
          max-width: 1100px;
          margin: 80px auto 0;
          padding: 60px 40px;
          text-align: center;
        }

        .welcome-section h1 {
          font-size: 3rem;
          color: #1e293b;
          margin-bottom: 20px;
          font-weight: 800;
        }

        .welcome-section p {
          font-size: 18px;
          color: #64748b;
          margin-bottom: 40px;
          line-height: 1.6;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 32px;
          margin-top: 50px;
        }

        .feature-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 32px;
          text-align: center;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
          transition: all 0.3s ease;
        }

        .feature-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.12);
          border-color: #6366f1;
        }

        .feature-card .icon {
          font-size: 3rem;
          margin-bottom: 16px;
        }

        .feature-card h3 {
          color: #1e293b;
          font-size: 20px;
          margin-bottom: 12px;
          font-weight: 700;
        }

        .feature-card p {
          color: #64748b;
          font-size: 15px;
          line-height: 1.6;
        }
      </style>
    </head>
    <body class="home-body">
      <header class="topbar app-topbar">
        <a class="brand" href="/home"><span class="brand-mark">&#9638;</span> EMI Calculator</a>
        <nav class="nav-menu" aria-label="Main navigation">
          <a href="/home" class="nav-item active">Home</a>
          <a href="/emi" class="nav-item">EMI Calculator</a>
          <div class="nav-item profile-menu" role="link" tabindex="0" onclick="window.location='/profile'">
            <span class="profile-menu-label">${userName}</span>
            <span class="caret">▾</span>
            <div class="profile-dropdown">
              <a href="/profile">Profile</a>
              <a href="/logout">Logout</a>
            </div>
          </div>
        </nav>
      </header>

<main class="blank-home">
        <section class="welcome-section">
          <h1>Welcome </h1>
          <p>Your all-in-one solution for smart loan calculations and financial planning</p>

          <div class="feature-grid">
            <div class="feature-card">
              <div class="icon"></div>
              <h3>EMI Calculator</h3>
              <p>Calculate your monthly EMI with precision. Get detailed breakdowns of interest and principal amounts.</p>
            </div>

            <div class="feature-card">
              <div class="icon"></div>
              <h3>Secure & Private</h3>
              <p>Your financial data is safe and secure. No data is stored on our servers.</p>
            </div>

            <div class="feature-card">
              <div class="icon"></div>
              <h3>Instant Results</h3>
              <p>Get instant calculations with real-time updates as you modify your loan parameters.</p>
            </div>
          </div>
        </section>
      </main>
    </body>
    </html>
  `);
});

app.get("/emi", requireLogin, (req, res) => {
  console.log('Route /emi requested by userId=' + (req.session && req.session.userId));
  const userName = req.session.userName || "Guest";

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>EMI Calculator</title>
      <link rel="stylesheet" href="style.css" />
      <style>
        /* Small adjustments for sliders and schedule */
        .range-row { display:flex; gap:12px; align-items:center; }
        .range-row input[type=range] { flex:1; }
        .range-value { width:110px; }
        .summary-cards { display:flex; gap:14px; margin-bottom:18px; }
        .card { flex:1; background:#fff; border-radius:12px; padding:18px; box-shadow:0 8px 24px rgba(0,0,0,0.06); text-align:center; }
        .card h4{ margin:0;color:#64748b;font-size:12px;font-weight:700; }
        .card p{ margin-top:8px;font-size:20px;color:#1e293b;font-weight:800 }
        .schedule-wrap{ max-height:360px; overflow:auto; border-radius:8px; border:1px solid #e2e8f0; background:#fff; }
        table.amort { width:100%; border-collapse:collapse; }
        table.amort th, table.amort td{ padding:10px; border-bottom:1px solid #f1f5f9; text-align:right; font-size:13px; }
        table.amort th{ text-align:left; background:#f8fafc; position:sticky; top:0; }
      </style>
    </head>
    <body class="home-body">
      <header class="topbar app-topbar">
        <a class="brand" href="/home"><span class="brand-mark">&#9638;</span> EMI Calculator</a>
        <nav class="nav-menu" aria-label="Main navigation">
          <a href="/home" class="nav-item"><span>⌂</span> Home</a>
          <a href="/emi" class="nav-item active"><span>▦</span> EMI Calculator</a>
          <div class="nav-item profile-menu" role="link" tabindex="0" onclick="window.location='/profile'">
            <span class="profile-menu-label">${userName}</span>
            <span class="caret">▾</span>
            <div class="profile-dropdown">
              <a href="/profile">Profile</a>
              <a href="/logout">Logout</a>
            </div>
          </div>
        </nav>
        <a class="logout-link" href="/logout"><span>⇥</span> Logout</a>
      </header>

      <main class="blank-home">
        <section class="emi-wrap">
          <div class="emi-header" style="margin-bottom:18px">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="background:rgba(255,255,255,0.08);padding:10px;border-radius:10px;font-size:18px">📟</div>
              <div class="title">EMI Calculator</div>
            </div>
          </div>

          <div class="emi-grid">
            <div class="form-box">
              <div class="form-row">
                <div class="field-container">
                  <label class="field-label">Loan Type</label>
                  <div class="field-inner">
                    <select id="loanType">
                      <option>Personal</option>
                      <option>Home</option>
                      <option>Auto</option>
                      <option>Education</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="form-row">
                <div class="field-container">
                  <label class="field-label">Loan Amount (₹)</label>
                  <div class="field-inner">
                    <input id="loanAmountRange" type="range" min="10000" max="10000000" step="10000" value="500000">
                    <div class="value-box"><input id="loanAmount" type="number" value="500000" min="10000" step="10000"></div>
                  </div>
                </div>
              </div>

              <div class="form-row">
                <div class="field-container">
                  <label class="field-label">Annual Interest Rate (%)</label>
                  <div class="field-inner">
                    <input id="rateRange" type="range" min="0" max="25" step="0.01" value="9.5">
                    <div class="value-box"><input id="rate" type="number" value="9.5" step="0.01"></div>
                  </div>
                </div>
              </div>

              <div class="form-row">
                <div class="field-container">
                  <label class="field-label">Processing Fee (%)</label>
                  <div class="field-inner">
                    <input id="feeRange" type="range" min="0" max="5" step="0.1" value="0.5">
                    <div class="value-box"><input id="fee" type="number" value="0.5" step="0.1"></div>
                  </div>
                </div>
              </div>

              <div class="form-row">
                <div class="field-container">
                  <label class="field-label">Loan Term</label>
                  <div class="field-inner">
                    <input id="termRange" type="range" min="1" max="360" step="1" value="60">
                    <div class="value-box"><input id="term" type="number" value="60" step="1"></div>
                    <div class="value-box small"><select id="monthsOrYears"><option value="months">Months</option><option value="years">Years</option></select></div>
                  </div>
                </div>
              </div>

            </div>

            <div class="result-box">
              <div class="summary-cards">
                <div class="card"><h4>MONTHLY EMI</h4><p id="emiValue">₹0</p></div>
                <div class="card"><h4>TOTAL INTEREST</h4><p id="interestValue">₹0</p></div>
                <div class="card"><h4>TOTAL PAYMENT</h4><p id="totalValue">₹0</p></div>
              </div>

              <div class="processing-actions">
                <span class="processing-pill">Processing Fee: <strong id="processingFeeAmount">₹0</strong></span>
                <div style="display:flex;gap:12px;align-items:center;margin-left:12px">
                  <button class="btn-save" id="saveBtn" type="button">Save</button>
                  <button class="btn-print" id="printBtn" type="button">Print Schedule</button>
                </div>
              </div>

              <h3 style="margin:12px 0 12px;">Amortization Schedule</h3>

              <div class="schedule-wrap">
                <table class="amort">
                  <thead>
                    <tr>
                      <th style="text-align:left; width:60px">Month</th>
                      <th style="width:120px">EMI (₹)</th>
                      <th style="width:140px">Principal (₹)</th>
                      <th style="width:120px">Interest (₹)</th>
                      <th style="width:140px">Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody id="scheduleBody">
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </main>

      <script>
        // sync range and numeric inputs
        function setRangeBackground(r) {
          // fill portion with blue and remainder with gray
          const min = Number(r.min) || 0;
          const max = Number(r.max) || 100;
          const val = Number(r.value) || 0;
          const pct = Math.round(((val - min) / (max - min)) * 100);
          r.style.background = 'linear-gradient(90deg,#1366ff ' + pct + '%, #e6edf5 ' + pct + '%)';
        }

        function bindRange(rangeId, inputId) {
          const r = document.getElementById(rangeId);
          const i = document.getElementById(inputId);
          // sync both ways
          r.addEventListener('input', () => { i.value = r.value; setRangeBackground(r); computeAndRender(); });
          i.addEventListener('input', () => { r.value = i.value; setRangeBackground(r); computeAndRender(); });
          // initialize background
          setRangeBackground(r);
        }

        bindRange('loanAmountRange', 'loanAmount');
        bindRange('rateRange', 'rate');
        bindRange('feeRange', 'fee');
        bindRange('termRange', 'term');

        const monthsOrYearsEl = document.getElementById('monthsOrYears');
        if (monthsOrYearsEl) monthsOrYearsEl.addEventListener('change', computeAndRender);
        const calcNowEl = document.getElementById('calcNow');
        if (calcNowEl) calcNowEl.addEventListener('click', computeAndRender);
        const printBtnEl = document.getElementById('printBtn');
        if (printBtnEl) printBtnEl.addEventListener('click', printSchedule);
        const saveBtnEl = document.getElementById('saveBtn');
        if (saveBtnEl) saveBtnEl.addEventListener('click', saveCalculation);

        function computeAndRender() {
          const loanType = document.getElementById('loanType').value;
          const principal = Number(document.getElementById('loanAmount').value) || 0;
          const annualRate = Number(document.getElementById('rate').value) || 0;
          const feePercent = Number(document.getElementById('fee').value) || 0;
          let term = Number(document.getElementById('term').value) || 0;
          const monthsOrYears = document.getElementById('monthsOrYears').value;

          if (monthsOrYears === 'years') term = term * 12;

          const monthlyRate = annualRate / 12 / 100;
          const emi = monthlyRate > 0
            ? (principal * monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1)
            : (term>0? principal/term : 0);

          const totalPayment = emi * term;
          const totalInterest = totalPayment - principal;
          const processingFeeAmount = principal * (feePercent/100);

          document.getElementById('emiValue').textContent = '₹' + formatMoney(emi);
          document.getElementById('interestValue').textContent = '₹' + formatMoney(totalInterest);
          document.getElementById('totalValue').textContent = '₹' + formatMoney(totalPayment);
          document.getElementById('processingFeeAmount').textContent = '₹' + formatMoney(processingFeeAmount);

          // build amortization schedule
          const tbody = document.getElementById('scheduleBody');
          tbody.innerHTML = '';

          let balance = principal;
          for (let m = 1; m <= term; m++) {
            const interest = balance * monthlyRate;
            const principalPortion = emi - interest;
            balance = Math.max(0, balance - principalPortion);

            const tr = document.createElement('tr');
            tr.innerHTML = '<td style="text-align:left">' + m + '</td>' +
                           '<td>₹' + formatMoney(emi) + '</td>' +
                           '<td>₹' + formatMoney(principalPortion) + '</td>' +
                           '<td>₹' + formatMoney(interest) + '</td>' +
                           '<td>₹' + formatMoney(balance) + '</td>';
            tbody.appendChild(tr);
          }

          // return computed object for save
          return {
            loanType, principal, annualRate, feePercent, termMonths: term, monthsOrYears,
            emi, totalInterest, totalPayment, processingFeeAmount,
            schedule: Array.from(tbody.querySelectorAll('tr')).map((row, idx) => {
              const cols = row.querySelectorAll('td');
              return {
                month: Number(cols[0].textContent),
                emi: cols[1].textContent.replace(/[₹,\s]/g, ''),
                principal: cols[2].textContent.replace(/[₹,\s]/g, ''),
                interest: cols[3].textContent.replace(/[₹,\s]/g, ''),
                balance: cols[4].textContent.replace(/[₹,\s]/g, '')
              };
            })
          };
        }

        function formatMoney(value) {
          return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
        }

        function escapeHtml(value) {
          return String(value).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
          })[char]);
        }

        function printSchedule() {
          const data = computeAndRender();
          const printWindow = window.open('', 'emi-print-preview', 'width=1100,height=800');
          if (!printWindow) {
            alert('Please allow pop-ups to print the schedule.');
            return;
          }

          const details = [
            ['Loan Amount Disbursed', '₹' + formatMoney(data.principal)],
            ['Current Interest (%)', Number(data.annualRate).toFixed(2)],
            ['Moratorium Interest Capitalized', 'NA'],
            ['Frequency', 'Monthly'],
            ['Loan Type', data.loanType + ' Loan'],
            ['Tenure (Months)', data.termMonths]
          ];
          const detailMarkup = details.map(item =>
            '<div class="detail-item"><span class="detail-label">' + escapeHtml(item[0]) + '</span><span class="detail-colon">:</span><span class="detail-value">' + escapeHtml(item[1]) + '</span></div>'
          ).join('');
          const scheduleRows = document.getElementById('scheduleBody').innerHTML;
          const documentHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Loan Amortization Schedule</title><style>' +
            '@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#3e3e45;font-family:Arial,sans-serif;background:#fff}.print-page{max-width:1120px;margin:0 auto;padding:18px 22px}.print-title{margin:0 0 22px;color:#bd1f60;font-size:25px;font-weight:500;text-align:center}.loan-details{margin-bottom:28px;border:2px solid #bd1f60}.loan-details-heading{margin:-16px auto 12px;width:max-content;padding:0 22px;color:#bd1f60;background:#fff;font-size:20px;text-align:center}.details-grid{display:grid;grid-template-columns:1fr 1fr}.detail-item{display:grid;grid-template-columns:235px 28px 1fr;min-height:72px;padding:16px;border-bottom:2px dotted #777;align-items:start;font-size:18px}.detail-item:nth-child(odd){border-right:2px solid #bd1f60}.detail-item:nth-last-child(-n+2){border-bottom:0}.detail-label{color:#bd1f60;line-height:1.32}.detail-value{font-size:18px;line-height:1.32}.schedule-title{margin:0 0 12px;color:#bd1f60;font-size:22px}.schedule-table{width:100%;border-collapse:collapse;font-size:13px}.schedule-table th{padding:10px;color:#fff;background:#5658df;text-align:right}.schedule-table th:first-child,.schedule-table td:first-child{text-align:center}.schedule-table td{padding:9px;border-bottom:1px solid #d9dce7;text-align:right}.schedule-table tbody tr:nth-child(even){background:#f7f8ff}@media print{.print-page{padding:0}.loan-details{break-inside:avoid}.schedule-table thead{display:table-header-group}}</style></head><body><main class="print-page"><h1 class="print-title">Loan Amortization Schedule</h1><section class="loan-details"><div class="loan-details-heading">Loan Details</div><div class="details-grid">' + detailMarkup + '</div></section><h2 class="schedule-title">Amortization Schedule</h2><table class="schedule-table"><thead><tr><th>Month</th><th>EMI (₹)</th><th>Principal (₹)</th><th>Interest (₹)</th><th>Balance (₹)</th></tr></thead><tbody>' + scheduleRows + '</tbody></table></main></body></html>';

          printWindow.document.open();
          printWindow.document.write(documentHtml);
          printWindow.document.close();
          printWindow.focus();
          printWindow.onload = () => printWindow.print();
        }

        function saveCalculation() {
          const data = computeAndRender();
          if (!data || !data.termMonths || data.termMonths <= 0) { alert('Please enter a valid term'); return; }

          fetch('/emi/save', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          })
          .then(r => r.json())
          .then(j => {
            if (j.success) alert('Calculation saved'); else alert('Save failed');
          })
          .catch(err => { console.error(err); alert('Save failed'); });
        }

        // initial render
        computeAndRender();
      </script>
    </body>
    </html>
  `);
});

app.get("/profile", requireLogin, async (req, res) => {
  console.log('Route /profile requested by userId=' + (req.session && req.session.userId));
  const userId = req.session.userId;

  try {
    const result = await pool.query(
      `SELECT id, name, email, mobile, dob, gender, address, city, pincode, occupation, employment_type, monthly_income, marital_status, residence_type, pan, aadhar, status, role, last_login
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.redirect('/logout');
    }

    const user = result.rows[0];
    const dobVal = user.dob
      ? (user.dob instanceof Date ? user.dob.toISOString().slice(0, 10) : String(user.dob).slice(0, 10))
      : '';
    const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';
    const initials = (user.name || user.email || 'U').split(/\s|@/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const profilePhotoUrl = typeof user.profile_photo_path === 'string' && /^\/uploads\/profile-photos\/[a-zA-Z0-9.-]+$/.test(user.profile_photo_path)
      ? user.profile_photo_path
      : '';
    const avatarContent = profilePhotoUrl
      ? `<img class="profile-photo" src="${profilePhotoUrl}" alt="Profile photo">`
      : `<span class="avatar-initials">${initials}</span>`;
    const removePhotoButton = profilePhotoUrl
      ? `<button type="button" class="avatar-remove" id="removeProfilePhotoBtn" aria-label="Remove profile photo" title="Remove profile photo">×</button>`
      : '';

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>My Account</title>
        <link rel="stylesheet" href="style.css">
        <style>
          .profile-grid{ display:grid; grid-template-columns:1fr 420px; gap:28px; }
          .field-row{ margin-bottom:12px; }
          .small-label{ font-size:13px; color:#64748b; margin-bottom:6px; display:block }
          .password-toggle{ position:relative }
          .toggle-btn{ position:absolute; right:12px; top:10px; cursor:pointer }
        </style>
      </head>
      <body class="home-body">
        <header class="topbar app-topbar">
          <a class="brand" href="/home"><span class="brand-mark">&#9638;</span> EMI Calculator</a>
          <nav class="nav-menu" aria-label="Main navigation">
            <a href="/home" class="nav-item"><span>⌂</span> Home</a>
            <a href="/emi" class="nav-item"><span>▦</span> EMI Calculator</a>
            <div class="nav-item profile-menu active">
              <span class="profile-menu-label">♙ My Account</span>
              <span class="caret">▾</span>
              <div class="profile-dropdown">
                <a href="/profile">Profile</a>
                <a href="/logout">Logout</a>
              </div>
            </div>
          </nav>
          <a class="logout-link" href="/logout"><span>⇥</span> Logout</a>
        </header>

        <main class="profile-page">
          <div class="profile-container">
            <div class="account-heading">
              <h1>My Account</h1>
              <p>Manage your profile information and account settings.</p>
            </div>

            <section class="profile-header-card">
              <div class="avatar-section">
                <div class="avatar-circle" id="profileAvatar">${avatarContent}${removePhotoButton}<label class="avatar-camera" for="profilePhotoInput" title="Change profile photo"><input id="profilePhotoInput" type="file" accept="image/jpeg,image/png,image/webp"><span>⌑</span></label></div>
                <div class="name-block"><div class="name">${user.name || user.email}</div><span class="role-bubble">${user.role || 'User'}</span><div class="status"><span></span> Active Account</div></div>
              </div>              <div class="info-blocks">
                <div class="info-item"><span class="info-icon email-icon">✉</span><span class="label">Email</span><span class="value">${user.email || '-'}</span></div>
                <div class="info-item"><span class="info-icon phone-icon">⌕</span><span class="label">Mobile</span><span class="value">${user.mobile || '-'}</span></div>
                <div class="info-item"><span class="info-icon role-icon">♧</span><span class="label">Role</span><span class="value">${user.role || 'User'}</span></div>
                <div class="info-item"><span class="info-icon login-icon">□</span><span class="label">Last Login</span><span class="value">${lastLogin}</span></div>
              </div>
            </section>

            <!-- Personal Information -->
            <div class="section-card" style="margin-top:18px">
              <div class="section-title">
                <span class="section-icon">♟</span>
                <h3>Personal Information</h3>
              </div>

              <div class="profile-fields">
                <div>
                  <label class="small-label">Full Name</label>
                  <input type="text" id="name" value="${user.name || ''}" />
                </div>
                <div>
                  <label class="small-label">Email</label>
                  <input type="email" id="email" value="${user.email || ''}" />
                </div>
                <div>
                  <label class="small-label">Mobile Number</label>
                  <input type="text" id="mobile" value="${user.mobile || ''}" />
                </div>

                <div>
                  <label class="small-label">Date of Birth</label>
                  <input type="date" id="dob" value="${dobVal}" />
                </div>

                <div>
                  <label class="small-label">Gender</label>
                  <select id="gender">
                    <option value="">Select</option>
                    <option value="Male" ${user.gender==='Male'?'selected':''}>Male</option>
                    <option value="Female" ${user.gender==='Female'?'selected':''}>Female</option>
                    <option value="Other" ${user.gender==='Other'?'selected':''}>Other</option>
                  </select>
                </div>

                <div>
                  <label class="small-label">Address</label>
                  <input type="text" id="address" value="${user.address || ''}" />
                </div>

                <div>
                  <label class="small-label">City</label>
                  <input type="text" id="city" value="${user.city || ''}" />
                </div>

                <div>
                  <label class="small-label">Pincode</label>
                  <input type="text" id="pincode" value="${user.pincode || ''}" />
                </div>
              </div>
            </div>

            <!-- Loan / Employment -->
            <div class="section-card" style="margin-top:18px">
              <div class="section-title">
                <span class="section-icon">▣</span>
                <h3>Loan / Employment Information</h3>
              </div>

              <div class="profile-fields employment-fields">
                <div>
                  <label class="small-label">Occupation</label>
                  <input type="text" id="occupation" value="${user.occupation || ''}" />
                </div>
                <div>
                  <label class="small-label">Employment Type</label>
                  <select id="employment_type">
                    <option value="">Select</option>
                    <option value="Salaried" ${user.employment_type==='Salaried'?'selected':''}>Salaried</option>
                    <option value="Self-Employed" ${user.employment_type==='Self-Employed'?'selected':''}>Self-Employed</option>
                    <option value="Student" ${user.employment_type==='Student'?'selected':''}>Student</option>
                    <option value="Other" ${user.employment_type==='Other'?'selected':''}>Other</option>
                  </select>
                </div>
                <div>
                  <label class="small-label">Monthly Income (₹)</label>
                  <input type="number" id="monthly_income" value="${user.monthly_income || ''}" />
                </div>
                <div>
                  <label class="small-label">Marital Status</label>
                  <select id="marital_status">
                    <option value="">Select</option>
                    <option value="Single" ${user.marital_status==='Single'?'selected':''}>Single</option>
                    <option value="Married" ${user.marital_status==='Married'?'selected':''}>Married</option>
                    <option value="Other" ${user.marital_status==='Other'?'selected':''}>Other</option>
                  </select>
                </div>

                <div>
                  <label class="small-label">Residence Type</label>
                  <select id="residence_type">
                    <option value="">Select</option>
                    <option value="Owned" ${user.residence_type==='Owned'?'selected':''}>Owned</option>
                    <option value="Rented" ${user.residence_type==='Rented'?'selected':''}>Rented</option>
                    <option value="Other" ${user.residence_type==='Other'?'selected':''}>Other</option>
                  </select>
                </div>
                <div>
                  <label class="small-label">PAN</label>
                  <input type="text" id="pan" value="${user.pan || ''}" />
                </div>
                <div>
                  <label class="small-label">Aadhar</label>
                  <input type="text" id="aadhar" value="${user.aadhar || ''}" />
                </div>

                <div class="save-row">
                  <button class="btn btn-primary" id="saveProfileBtn" type="button">Save Changes</button>
                  <span id="profileMsg" style="margin-left:12px;color:green"></span>
                </div>
              </div>
            </div>

            <!-- Security / Change Password -->
            <div class="section-card" style="margin-top:18px">
              <div class="section-title">
                <span class="section-icon">♙</span>
                <h3>Security / Change Password</h3>
              </div>

              <div class="password-row">
                <div>
                  <label class="small-label">New Password</label>
                  <input type="password" id="newPassword" placeholder="Enter new password" />
                </div>
                <div>
                  <label class="small-label">Confirm Password</label>
                  <input type="password" id="confirmPassword" placeholder="Confirm new password" />
                </div>
                <div style="display:flex; justify-content:flex-end; align-items:flex-end; gap:8px;">
                  <button class="btn btn-primary" id="updatePasswordBtn" type="button">Update Password</button>
                  <span id="passMsg" style="margin-left:12px;color:green"></span>
                </div>
              </div>

              <div class="profile-hint">Keep your information up to date for a better loan experience.</div>
            </div>

          </div>
        </main>

        <script>
          const profilePhotoInput = document.getElementById('profilePhotoInput');
          const removeProfilePhotoBtn = document.getElementById('removeProfilePhotoBtn');

          async function handleProfilePhotoResponse(res) {
            let data = null;
            try {
              data = await res.json();
            } catch (err) {
              const text = await res.text().catch(() => '');
              throw new Error(text || 'Request failed.');
            }
            if (!res.ok || !data || !data.success) {
              throw new Error((data && data.error) || 'Request failed.');
            }
            return data;
          }

          if (profilePhotoInput) {
            profilePhotoInput.addEventListener('change', async () => {
              const file = profilePhotoInput.files && profilePhotoInput.files[0];
              if (!file) return;

              const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
              if (!allowedTypes.includes(file.type) || file.size > 3 * 1024 * 1024) {
                alert('Choose a JPG, PNG, or WebP image smaller than 3 MB.');
                profilePhotoInput.value = '';
                return;
              }

              const reader = new FileReader();
              reader.onload = async () => {
                try {
                  const res = await fetch('/profile/photo', {
                    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: reader.result })
                  });
                  await handleProfilePhotoResponse(res);
                  window.location.reload();
                } catch (err) {
                  console.error(err);
                  alert(err.message || 'Could not upload your profile photo.');
                  profilePhotoInput.value = '';
                }
              };
              reader.readAsDataURL(file);
            });
          }

          if (removeProfilePhotoBtn) {
            removeProfilePhotoBtn.addEventListener('click', async () => {
              try {
                const res = await fetch('/profile/photo', {
                  method: 'DELETE', credentials: 'same-origin'
                });
                await handleProfilePhotoResponse(res);
                window.location.reload();
              } catch (err) {
                console.error(err);
                alert(err.message || 'Could not remove the profile photo.');
              }
            });
          }

          document.getElementById('saveProfileBtn').addEventListener('click', async () => {
            const payload = {
              name: document.getElementById('name').value,
              email: document.getElementById('email').value,
              mobile: document.getElementById('mobile').value,
              dob: document.getElementById('dob').value,
              gender: document.getElementById('gender').value,
              address: document.getElementById('address').value,
              city: document.getElementById('city').value,
              pincode: document.getElementById('pincode').value,
              occupation: document.getElementById('occupation') ? document.getElementById('occupation').value : null,
              employment_type: document.getElementById('employment_type') ? document.getElementById('employment_type').value : null,
              monthly_income: document.getElementById('monthly_income') ? document.getElementById('monthly_income').value : null,
              marital_status: document.getElementById('marital_status') ? document.getElementById('marital_status').value : null,
              residence_type: document.getElementById('residence_type') ? document.getElementById('residence_type').value : null,
              pan: document.getElementById('pan') ? document.getElementById('pan').value : null,
              aadhar: document.getElementById('aadhar') ? document.getElementById('aadhar').value : null
            };

            try {
              const res = await fetch('/profile/update', {
                method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
              });
              const j = await res.json();
              document.getElementById('profileMsg').textContent = j.success ? 'Saved' : (j.error||'Failed');
              if (j.success) setTimeout(()=>document.getElementById('profileMsg').textContent='',3000);
            } catch (err) { console.error(err); document.getElementById('profileMsg').textContent='Save failed'; }
          });

          document.getElementById('updatePasswordBtn').addEventListener('click', async () => {
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const el = document.getElementById('passMsg');
            if (!newPassword || newPassword.length < 4) { el.style.color='red'; el.textContent='Password too short'; return; }
            if (newPassword !== confirmPassword) { el.style.color='red'; el.textContent='Passwords do not match'; return; }

            try {
              const res = await fetch('/profile/change-password', {
                method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword })
              });
              const j = await res.json();
              el.style.color = j.success ? 'green' : 'red';
              el.textContent = j.success ? 'Password updated' : (j.error||'Update failed');
              if (j.success) setTimeout(()=>el.textContent='',3000);
            } catch (err) { console.error(err); el.style.color='red'; el.textContent='Update failed'; }
          });

          // show/hide password toggles (using inline SVG icons) — wrap input so icon sits inside the input field
          function addPasswordToggle(inputId) {
            const inp = document.getElementById(inputId);
            if (!inp) return;

            // create a wrapper around the input so the button can be absolutely positioned inside the input area
            const wrapper = document.createElement('div');
            wrapper.className = 'pw-wrapper';
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block';
            wrapper.style.width = '100%';

            // replace the input with wrapper, then move input inside wrapper
            const originalParent = inp.parentElement;
            originalParent.replaceChild(wrapper, inp);

            // move the input under the wrapper
            wrapper.appendChild(inp);

            // ensure input reserves space for the icon
            inp.style.paddingRight = '48px';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'toggle-btn';
            btn.setAttribute('aria-label', 'Toggle password visibility');
            const eyeSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>';
            const eyeOffSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17.94 17.94A10.97 10.97 0 0 1 12 19c-6 0-10-7-10-7 .9-1.55 2.22-3.33 3.8-4.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 1l22 22" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

            btn.innerHTML = eyeSvg;
            btn.addEventListener('click', () => {
              if (inp.type === 'password') { inp.type = 'text'; btn.innerHTML = eyeOffSvg; } else { inp.type = 'password'; btn.innerHTML = eyeSvg; }
            });

            // append button inside wrapper so it sits above the input at the far right
            wrapper.appendChild(btn);
          }
          addPasswordToggle('newPassword');
          addPasswordToggle('confirmPassword');
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Profile error', err);
    return res.status(500).send('Server error');
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.send("Logout failed");
    }
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rowCount > 0) {
      return res.send(`
        <div style="font-family:Arial;text-align:center;margin-top:100px">
          <h1>User Already Exists!</h1>
          <p>This email is already registered.</p>
          <a href="/register">Try Again</a>
        </div>
      `);
    }

    await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
      [name, email, password]
    );

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
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND password = $2",
      [email, password]
    );

    if (result.rowCount > 0) {
      const user = result.rows[0];
      req.session.userId = user.id;
      req.session.userName = user.name || email.split("@")[0];
      req.session.userEmail = user.email;

      // Update last_login timestamp for the user
      try {
        await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);
      } catch (err) {
        console.error('Failed to update last_login:', err);
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
});

// API endpoints: profile update, change password, save EMI calculation

app.post('/profile/update', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  console.log('POST /profile/update userId=', userId, 'payload=', req.body);
  const { name, email, mobile, dob, gender, address, city, pincode } = req.body;
  try {
    await pool.query(
      `UPDATE users SET name=$1, email=$2, mobile=$3, dob=$4, gender=$5, address=$6, city=$7, pincode=$8, occupation=$9, employment_type=$10, monthly_income=$11, marital_status=$12, residence_type=$13, pan=$14, aadhar=$15 WHERE id=$16`,
      [name || null, email || null, mobile || null, dob || null, gender || null, address || null, city || null, pincode || null, req.body.occupation || null, req.body.employment_type || null, req.body.monthly_income || null, req.body.marital_status || null, req.body.residence_type || null, req.body.pan || null, req.body.aadhar || null, userId]
    );
    // update session name/email to reflect changes
    req.session.userName = name || req.session.userName;
    req.session.userEmail = email || req.session.userEmail;
    console.log('Profile updated for userId=', userId);
    return res.json({ success: true });
  } catch (err) {
    console.error('Profile update error', err);
    return res.json({ success: false, error: 'Update failed' });
  }
});

app.post('/profile/photo', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const imageData = req.body && req.body.image;
  const match = typeof imageData === 'string'
    ? imageData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/)
    : null;

  if (!match) {
    return res.status(400).json({ success: false, error: 'Use a JPG, PNG, or WebP image.' });
  }

  const mimeType = match[1];
  const imageBuffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!imageBuffer.length || imageBuffer.length > maxProfilePhotoBytes || !hasValidImageSignature(imageBuffer, mimeType)) {
    return res.status(400).json({ success: false, error: 'The selected image is invalid or exceeds 3 MB.' });
  }

  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mimeType];
  const fileName = `${userId}-${crypto.randomBytes(20).toString('hex')}.${extension}`;
  const filePath = path.join(profilePhotoDirectory, fileName);
  const publicPath = `${profilePhotoUrlPrefix}${fileName}`;

  try {
    const existing = await pool.query('SELECT profile_photo_path FROM users WHERE id = $1', [userId]);
    const currentPath = existing.rows[0] && typeof existing.rows[0].profile_photo_path === 'string'
      ? existing.rows[0].profile_photo_path
      : '';
    if (currentPath && currentPath.startsWith(profilePhotoUrlPrefix)) {
      const currentFile = path.join(__dirname, 'public', currentPath.replace(/^\//, ''));
      await fs.promises.unlink(currentFile).catch(() => {});
    }

    await fs.promises.writeFile(filePath, imageBuffer, { flag: 'wx', mode: 0o600 });
    const update = await pool.query(
      'UPDATE users SET profile_photo_path = $1 WHERE id = $2',
      [publicPath, userId]
    );

    if (update.rowCount !== 1) {
      await fs.promises.unlink(filePath).catch(() => {});
      return res.status(404).json({ success: false, error: 'User account was not found.' });
    }

    return res.json({ success: true, photoPath: publicPath });
  } catch (err) {
    console.error('Profile photo upload error', err);
    await fs.promises.unlink(filePath).catch(() => {});
    return res.status(500).json({ success: false, error: 'Could not save the profile photo.' });
  }
});

app.delete('/profile/photo', requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    const result = await pool.query('SELECT profile_photo_path FROM users WHERE id = $1', [userId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'User account was not found.' });
    }

    const currentPath = result.rows[0].profile_photo_path;
    if (currentPath && currentPath.startsWith(profilePhotoUrlPrefix)) {
      const fileName = currentPath.replace(profilePhotoUrlPrefix, '');
      const filePath = path.join(profilePhotoDirectory, fileName);
      await fs.promises.unlink(filePath).catch(() => {});
    }

    await pool.query('UPDATE users SET profile_photo_path = NULL WHERE id = $1', [userId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Profile photo delete error', err);
    return res.status(500).json({ success: false, error: 'Could not delete the profile photo.' });
  }
});

app.post('/profile/change-password', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  console.log('POST /profile/change-password userId=', userId);
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return res.json({ success: false, error: 'Invalid password' });
  try {
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newPassword, userId]);
    console.log('Password updated for userId=', userId);
    return res.json({ success: true });
  } catch (err) {
    console.error('Change password error', err);
    return res.json({ success: false, error: 'Change failed' });
  }
});

app.post('/emi/save', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  console.log('POST /emi/save userId=', userId);
  try {
    const { loanType, principal, annualRate, feePercent, termMonths, monthsOrYears, emi, totalInterest, totalPayment, processingFeeAmount, schedule } = req.body;
    console.log('emi save payload', { loanType, principal, annualRate, feePercent, termMonths });
    await pool.query(
      `INSERT INTO emi_calculations (user_id, loan_type, loan_amount, annual_rate, processing_fee_percent, term_months, months_or_years, monthly_emi, total_interest, total_payment, processing_fee_amount, schedule)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [userId, loanType || null, principal || 0, annualRate || 0, feePercent || 0, termMonths || 0, monthsOrYears || null, emi || 0, totalInterest || 0, totalPayment || 0, processingFeeAmount || 0, schedule ? JSON.stringify(schedule) : null]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('EMI save error', err);
    return res.json({ success: false, error: 'Save failed' });
  }
});

app.use(express.static(path.join(__dirname, "public")));

initializeDatabase()
  .then(() => {
    app.listen(PORT, "127.0.0.1", () => {
      console.log("");
      console.log("======================================");
      console.log(" Login Page is running successfully!");
      console.log(" Open: http://localhost:3000");
      console.log(" Database: PostgreSQL");
      console.log("======================================");
    });
  })
  .catch((error) => {
    console.error("Database connection error:", error);
    process.exit(1);
  });
