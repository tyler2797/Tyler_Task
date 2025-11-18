from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
from emergentintegrations.llm.chat import LlmChat, UserMessage
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Helper function to convert ObjectId
def str_object_id(obj):
    if isinstance(obj, dict):
        if '_id' in obj and isinstance(obj['_id'], ObjectId):
            obj['_id'] = str(obj['_id'])
    return obj


# Define Models
class ParseMessageRequest(BaseModel):
    message: str

class ParsedReminder(BaseModel):
    title: str
    description: Optional[str] = None
    date: Optional[str] = None  # Format: YYYY-MM-DD
    time: Optional[str] = None  # Format: HH:MM
    datetime_iso: Optional[str] = None  # Full ISO datetime
    timezone: str = "Europe/Paris"
    is_ambiguous: bool = False
    ambiguity_reason: Optional[str] = None

class ReminderCreate(BaseModel):
    title: str
    description: Optional[str] = None
    datetime_iso: str  # ISO format datetime
    timezone: str = "Europe/Paris"
    recurrence: Optional[str] = None

class Reminder(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    datetime_iso: str
    timezone: str
    status: str = "scheduled"  # scheduled, completed, cancelled
    recurrence: Optional[str] = None
    created_at: str
    updated_at: str

class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    datetime_iso: Optional[str] = None
    status: Optional[str] = None
    recurrence: Optional[str] = None


# NLU Parsing Service
async def parse_natural_language_message(message: str) -> ParsedReminder:
    """Parse a natural language message to extract reminder information"""
    try:
        llm_key = os.environ.get('EMERGENT_LLM_KEY')
        if not llm_key:
            raise ValueError("EMERGENT_LLM_KEY not found in environment")
        
        system_prompt = """Tu es un assistant spécialisé dans l'extraction d'informations de rappels depuis des messages en français.
Tu dois extraire: titre, description optionnelle, date, heure, et déterminer si le message est ambigu.

Date du jour: {today}
Heure actuelle: {now}

Règles importantes:
1. Si la date/heure n'est pas claire, marque is_ambiguous=true et explique pourquoi
2. Convertis les dates relatives ("demain", "dans 2 jours", "lundi prochain") en dates absolues
3. Si l'heure n'est pas spécifiée, marque is_ambiguous=true
4. Utilise le format ISO 8601 pour datetime_iso
5. Le timezone par défaut est Europe/Paris

Réponds UNIQUEMENT avec un JSON valide au format:
{
  "title": "titre du rappel",
  "description": "description optionnelle ou null",
  "date": "YYYY-MM-DD ou null",
  "time": "HH:MM ou null",
  "datetime_iso": "YYYY-MM-DDTHH:MM:SS+01:00 ou null",
  "timezone": "Europe/Paris",
  "is_ambiguous": false,
  "ambiguity_reason": "raison si ambigu ou null"
}"""
        
        today = datetime.now().strftime("%Y-%m-%d")
        now = datetime.now().strftime("%H:%M")
        system_prompt = system_prompt.format(today=today, now=now)
        
        chat = LlmChat(
            api_key=llm_key,
            session_id=str(uuid.uuid4()),
            system_message=system_prompt
        ).with_model("openai", "gpt-4o-mini")
        
        user_message = UserMessage(text=f"Message à parser: {message}")
        response = await chat.send_message(user_message)
        
        logger.info(f"LLM Response: {response}")
        
        # Parse the JSON response
        import json
        # Clean the response if it contains markdown code blocks
        response_text = response.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        parsed_data = json.loads(response_text)
        return ParsedReminder(**parsed_data)
        
    except Exception as e:
        logger.error(f"Error parsing message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors du parsing: {str(e)}")


# API Routes
@api_router.get("/")
async def root():
    return {"message": "API de rappels par message IA"}


@api_router.post("/parse-message", response_model=ParsedReminder)
async def parse_message(request: ParseMessageRequest):
    """Parse un message en langage naturel pour extraire les informations du rappel"""
    return await parse_natural_language_message(request.message)


@api_router.post("/reminders", response_model=Reminder)
async def create_reminder(reminder: ReminderCreate):
    """Créer un nouveau rappel"""
    try:
        reminder_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        reminder_doc = {
            "id": reminder_id,
            "title": reminder.title,
            "description": reminder.description,
            "datetime_iso": reminder.datetime_iso,
            "timezone": reminder.timezone,
            "status": "scheduled",
            "recurrence": reminder.recurrence,
            "created_at": now,
            "updated_at": now
        }
        
        await db.reminders.insert_one(reminder_doc)
        
        # Remove MongoDB _id before returning
        reminder_doc.pop('_id', None)
        return Reminder(**reminder_doc)
        
    except Exception as e:
        logger.error(f"Error creating reminder: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création: {str(e)}")


@api_router.get("/reminders", response_model=List[Reminder])
async def get_reminders(status: Optional[str] = None):
    """Récupérer la liste des rappels"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        reminders = await db.reminders.find(query).sort("datetime_iso", 1).to_list(1000)
        
        # Remove MongoDB _id from all reminders
        for reminder in reminders:
            reminder.pop('_id', None)
        
        return [Reminder(**reminder) for reminder in reminders]
        
    except Exception as e:
        logger.error(f"Error fetching reminders: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération: {str(e)}")


@api_router.get("/reminders/{reminder_id}", response_model=Reminder)
async def get_reminder(reminder_id: str):
    """Récupérer un rappel spécifique"""
    try:
        reminder = await db.reminders.find_one({"id": reminder_id})
        
        if not reminder:
            raise HTTPException(status_code=404, detail="Rappel non trouvé")
        
        reminder.pop('_id', None)
        return Reminder(**reminder)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching reminder: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération: {str(e)}")


@api_router.patch("/reminders/{reminder_id}", response_model=Reminder)
async def update_reminder(reminder_id: str, update: ReminderUpdate):
    """Mettre à jour un rappel"""
    try:
        reminder = await db.reminders.find_one({"id": reminder_id})
        
        if not reminder:
            raise HTTPException(status_code=404, detail="Rappel non trouvé")
        
        # Prepare update data
        update_data = update.dict(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        # Update in database
        await db.reminders.update_one(
            {"id": reminder_id},
            {"$set": update_data}
        )
        
        # Fetch updated reminder
        updated_reminder = await db.reminders.find_one({"id": reminder_id})
        updated_reminder.pop('_id', None)
        
        return Reminder(**updated_reminder)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating reminder: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour: {str(e)}")


@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str):
    """Supprimer un rappel"""
    try:
        result = await db.reminders.delete_one({"id": reminder_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Rappel non trouvé")
        
        return {"message": "Rappel supprimé avec succès", "id": reminder_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting reminder: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression: {str(e)}")


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
