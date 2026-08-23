# CreditWise AI

AI-powered loan assistant platform for company verification, EMI calculations, and financial guidance.

## Features

- **AI Chat Assistant** — Context-aware conversational interface for loan and financial queries
- **Company Search** — Search 590,000+ bank records by company name with structured tabular output
- **EMI Calculator** — Calculate monthly payments, total interest, and amortization schedules
- **Bank Document Management** — Upload and parse bank PDFs/CSVs into structured company data
- **User Authentication** — Session-based login/registration with profile management
- **Admin Panel** — Manage bank documents and view all users

## Tech Stack

**Backend**
- Python 3.14
- Flask 3.0.0
- Flask-Session 0.5.0
- psycopg2-binary 2.9.12

**Database**
- PostgreSQL — primary data store
- SQLite — session storage via Flask-Session

**Frontend**
- HTML5 / CSS3 / JavaScript (vanilla)
- Responsive chat UI with dynamic DOM rendering

**APIs & Integrations**
- REST API architecture
- DuckDuckGo Search integration
- Internal CSV/PDF bank document parser

## Installation

```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt
```

## Configuration

Set PostgreSQL credentials via environment variables or edit `db.py`:

```env
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=login_db
```

## Database Setup

The app auto-creates required tables on first run:
- `users` — user accounts
- `emi_calculations` — saved EMI records
- `bank_uploaded_files` — uploaded bank documents
- `bank_company_data` — extracted company/bank records
- `company_basic_info` — company profiles
- `company_financial_info` — company financials

## Running the App

```bash
python app.py
```

Open http://localhost:3000

**Demo login:** `admin@gmail.com` / `1234`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send chat message |
| POST | `/api/company/search` | Search company bank records |
| GET | `/api/bank/files` | List uploaded bank files |
| POST | `/api/bank/upload` | Upload bank PDF/CSV |
| DELETE | `/api/bank/files/<id>` | Delete bank file |
| GET | `/api/admin/users` | List all users |

## Project Structure

```
├── app.py                 # Flask application and API routes
├── db.py                  # PostgreSQL connection pool
├── requirements.txt       # Python dependencies
├── server.js              # Legacy Node.js server
├── package.json           # Node dependencies
├── templates/             # Flask HTML templates
│   ├── home.html
│   ├── emi.html
│   ├── admin.html
│   └── profile.html
├── public/                # Static assets and uploads
│   ├── uploads/
│   ├── style.css
│   └── *.html
└── flask_session/         # Session storage
```

## Key Features in Detail

### Company Search
- Searches across 590,000+ bank records from 8 major banks
- Returns structured table: Bank Name, SR No, Category, Other Info
- Context maintained in chat history

### Bank Document Processing
- Upload CSV/PDF bank datasets
- Auto-parses and ingests into `bank_company_data`
- Batch insertion with `execute_batch` for performance

### Chat Experience
- Persistent chat history in localStorage
- Company search with styled tabular results
- EMI calculation assistance
- Clear history functionality

## License

MIT
