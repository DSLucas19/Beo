@echo off
echo ===================================================
echo          KHOI DONG FRAMEWORK BEO (PHASE 1)
echo ===================================================

:: Kiem tra Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Khong tim thay Python. Vui long cai dat Python 3.10+ va add vao PATH.
    pause
    exit /b
)

:: Kiem tra Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Khong tim thay Node.js. Vui long cai dat Node.js va add vao PATH.
    pause
    exit /b
)

:: 1. Thiet lap & Chay Backend
echo [*] Dang thiet lap va khoi dong Backend FastAPI...
cd backend
if not exist venv (
    echo [+] Dang tao moi moi truong ao venv...
    python -m venv venv
)

echo [+] Kich hoat venv va cai dat dependencies...
call venv\Scripts\activate
pip install -r requirements.txt

if not exist .env (
    echo [+] Copy cấu hình mau .env.example -> .env
    copy .env.example .env
)

echo [+] Dang khoi dong Backend trong cua so moi...
start cmd /k "title Beo Backend Gateway && venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"

:: 2. Thiet lap & Chay Frontend
echo [*] Dang thiet lap va khoi dong Frontend...
cd ../frontend

echo [+] Dang cai dat thu vien npm (npm install)...
call npm install

echo [+] Dang khoi dong Frontend dev server trong cua so moi...
start cmd /k "title Beo Frontend Client && npm run dev"

echo ===================================================
echo [OK] He thong dang khoi chay:
echo  - API Backend: http://localhost:8000
echo  - Giao dien Web: http://localhost:3000
echo ===================================================
cd ..
pause
