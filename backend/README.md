# WattWise Python FastAPI Backend

High-performance, modular FastAPI backend powering the WattWise mobile application.

## Key Capabilities
- **Multi-Utility Bill Decomposition**: Analyzes photographed or uploaded statements (Electricity, Water, Wi-Fi / Broadband) and decomposes them into itemized charges, tariff rates, baseline usage, and appliance draw.
- **AI Utility Assistant**: Conversational intelligence endpoint capable of answering questions about electricity consumption, inverter air conditioning optimization, water baseline ($m^3$) and leak diagnostics, and Wi-Fi router 24/7 power draw.
- **Appliance Telemetry & Optimization**: Tracks cooling, refrigeration, ventilation, laundry, and standby load, with thermostat eco-scheduling endpoints.
- **Notifications & Household Profile**: Real-time alerts and household settings.

## Getting Started

### 1. Requirements
- Python 3.10+
- Dependencies listed in `requirements.txt`

### 2. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 3. Run the Server
```bash
python run.py
```
Or directly with Uvicorn:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Interactive API Documentation
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/api/health

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & supported utility types |
| `POST` | `/api/bills/analyze` | Upload and analyze bill image (multipart) |
| `POST` | `/api/bills/analyze-json` | Analyze bill via JSON payload |
| `GET` | `/api/bills` | List recent verified statements |
| `GET` | `/api/bills/current` | Active statement & itemized charges |
| `POST` | `/api/chat` | AI Assistant query |
| `GET` | `/api/chat/suggested-prompts` | Prompt suggestion pills |
| `GET` | `/api/appliances` | Household appliance telemetry |
| `POST` | `/api/appliances/optimize` | Apply 25°C thermostat schedule |
| `POST` | `/api/appliances/reset` | Reset thermostat schedule |
| `GET` | `/api/notifications` | List household notifications |
| `POST` | `/api/notifications/{id}/read` | Mark notification read |
| `GET` | `/api/profile` | Household profile & budget |
| `PUT` | `/api/profile/budget` | Update target budget |

