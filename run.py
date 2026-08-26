from app import app

if __name__ == '__main__':
    print("=" * 50)
    print(" InCraax AI - Loan Assistant Platform")
    print(" Open: http://localhost:3000")
    print(" Database: PostgreSQL")
    print("=" * 50)
    app.run(host='0.0.0.0', port=3000, debug=False)
