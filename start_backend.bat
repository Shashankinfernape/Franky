@echo off
echo Starting Emiot Autonomous Core Backend...
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
