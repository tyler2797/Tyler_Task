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
from openai import AsyncOpenAI
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

# Initialize OpenAI client
openai_client = AsyncOpenAI(api_key=os.environ.get('OPENAI_API_KEY'))


# Database initialization
async def init_db_indexes():
    """Initialize database indexes on startup"""
    try:
        # Create unique index on 'id' field
        await db.reminders.create_index([("id", 1)], unique=True)
        # Create index on 'datetime_iso' for sorting
        await db.reminders.create_index([("datetime_iso", 1)])
        # Create compound index for filtered queries
        await db.reminders.create_index([("status", 1), ("datetime_iso", 1)])
        logger.info("✅ Database indexes initialized successfully")
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {str(e)}")


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

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[dict]] = []

class ChatResponse(BaseModel):
    response: str
    type: str  # "question", "suggestion", "confirmation", "multiple_tasks"
    suggestions: Optional[List[str]] = None
    parsed_reminders: Optional[List[ParsedReminder]] = None


# NLU Parsing Service with OpenAI
async def parse_natural_language_message(message: str) -> ParsedReminder:
    """Parse a natural language message to extract reminder information"""
    try:
        from datetime import datetime, timedelta
        import json
        import re
        
        today = datetime.now()
        today_str = today.strftime("%A %d %B %Y")
        now_str = today.strftime("%H:%M")
        
        system_prompt = f"""Tu es un expert en extraction d'informations de rappels en français.

CONTEXTE:
- Aujourd'hui: {today_str}
- Heure: {now_str}
- Année: {today.year}

RÈGLES:
1. Extrais le titre (action principale)
2. Convertis dates relatives en absolues
3. Format: YYYY-MM-DD pour date, HH:MM pour heure
4. datetime_iso: format ISO 8601 avec +01:00
5. RÉPONDS EN JSON PUR"""
        
        user_prompt = f"""Message: "{message}"

JSON:
{{
  "title": "action",
  "description": null,
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "datetime_iso": "YYYY-MM-DDTHH:MM:00+01:00",
  "timezone": "Europe/Paris",
  "is_ambiguous": false,
  "ambiguity_reason": null
}}"""
        
        response = await openai_client.chat.completions.create(
            model="gpt-5.1",  # Le meilleur modèle d'OpenAI (Mise à jour demandée)
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        
        response_text = response.choices[0].message.content.strip()
        logger.info(f"OpenAI Response: {response_text}")
        
        parsed_data = json.loads(response_text)
        return ParsedReminder(**parsed_data)
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur JSON: {str(e)}")
    except Exception as e:
        logger.error(f"Error parsing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur parsing: {str(e)}")


# Intelligent Chatbot Service for ADHD users
async def intelligent_chat_assistant(message: str, history: List[dict] = []) -> ChatResponse:
    """Assistant IA conversationnel pour aider les utilisateurs TDAH"""
    try:
        logger.info(f"📨 Message reçu: '{message}'")
        logger.info(f"📚 Historique ({len(history)} messages): {history}")
        llm_key = os.environ.get('EMERGENT_LLM_KEY')
        if not llm_key:
            raise ValueError("EMERGENT_LLM_KEY not found in environment")
        
        from datetime import datetime, timedelta
        import json
        import re
        
        today = datetime.now()
        today_str = today.strftime("%A %d %B %Y")
        now_str = today.strftime("%H:%M")
        tomorrow = (today + timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Reconstruct context from history
        context_info = {
            "task": None,
            "date": None,
            "time": None,
            "waiting_for": None
        }
        
        # Parse history to understand what we're waiting for
        if history:
            last_messages = history[-4:]  # Last 4 messages
            full_context = " ".join([h.get('content', '') for h in last_messages])
            
            # Extract task from first user message
            for h in history:
                if h.get('role') == 'user':
                    # Extract potential task name
                    task_words = h.get('content', '').lower()
                    if any(word in task_words for word in ['rappel', 'appel', 'rdv', 'rendez-vous', 'médecin', 'dentiste', 'courses']):
                        context_info["task"] = h.get('content', '')
                        break
            
            # Check if we asked for date or time
            for h in reversed(history[-2:]):
                content = h.get('content', '').lower()
                if 'manque la date' in content or 'quelle date' in content or 'c\'est quand' in content:
                    context_info["waiting_for"] = "date"
                elif 'manque l\'heure' in content or 'quelle heure' in content or 'à quelle heure' in content:
                    context_info["waiting_for"] = "time"
                
                # Extract date if present
                if 'demain' in content:
                    context_info["date"] = tomorrow
                elif re.search(r'\d{4}-\d{2}-\d{2}', content):
                    date_match = re.search(r'\d{4}-\d{2}-\d{2}', content)
                    context_info["date"] = date_match.group(0)
        
        # If user is answering with just time (like "14h")
        if context_info["waiting_for"] == "time" and re.match(r'^\d{1,2}h?\d{0,2}$', message.strip()):
            # User is giving just the time
            time_str = message.strip()
            if not 'h' in time_str and not ':' in time_str:
                time_str = time_str + "h00"
            elif 'h' in time_str and len(time_str.split('h')[1]) == 0:
                time_str = time_str + "00"
            
            # Reconstruct full message with task, date AND time
            if context_info["task"] and context_info["date"]:
                # We have all info: task + date + time
                full_message = f"{context_info['task']} {context_info['date']} {time_str}"
                parsed = await parse_natural_language_message(full_message)
                
                encouragements = [
                    "Parfait! C'est noté! 🚀",
                    "Super! Ton rappel est prêt! 😊",
                    "Excellent! Je m'en souviens pour toi! ✨"
                ]
                import random
                
                return ChatResponse(
                    response=f"{random.choice(encouragements)}\n\n📝 Rappel: {parsed.title}\n📅 Date: {parsed.date}\n⏰ Heure: {parsed.time}",
                    type="confirmation",
                    suggestions=["Créer ce rappel", "Modifier", "Annuler"],
                    parsed_reminders=[parsed]
                )

        
        # If user is answering with just date (like "demain")
        if context_info["waiting_for"] == "date" and len(message.split()) <= 2:
            if any(word in message.lower() for word in ['demain', 'aujourd\'hui', 'lundi', 'mardi']):
                context_info["date"] = message
                
                # Now ask for time
                return ChatResponse(
                    response=f"Cool! {message.capitalize()}. Et à quelle heure? ⏰",
                    type="question",
                    suggestions=["9h00", "14h00", "18h00"],
                    parsed_reminders=None
                )
        
        # Detect multiple tasks first
        task_indicators = ['et', ',', 'puis', 'après', 'ensuite', 'aussi']
        has_multiple_tasks = any(indicator in message.lower() for indicator in task_indicators)
        
        if has_multiple_tasks and len(message.split()) > 5:
            tasks = re.split(r',|\set\s|\spuis\s|\saprès\s|\sensuite\s|\saussi\s', message)
            tasks = [t.strip() for t in tasks if len(t.strip()) > 3]
            
            if len(tasks) > 1:
                task_list = "\n".join([f"• {task}" for task in tasks])
                return ChatResponse(
                    response=f"🎯 J'ai repéré {len(tasks)} tâches! Parfait:\n\n{task_list}\n\nJe crée un rappel pour chacune? (Ton futur toi va adorer! 😊)",
                    type="multiple_tasks",
                    suggestions=["Oui!", "Non, juste la 1ère", "Combine-les"],
                    parsed_reminders=None
                )
        
        # Check what's missing in current message
        has_date = any(word in message.lower() for word in ['demain', 'aujourd\'hui', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']) or re.search(r'\d{1,2}[/-]\d{1,2}', message.lower())
        has_time = re.search(r'\d{1,2}h\d{0,2}|\d{1,2}:\d{2}', message)
        
        if not has_date:
            tomorrow_str = (today + timedelta(days=1)).strftime("%A %d %B")
            return ChatResponse(
                response=f"Ok! Pour '{message}', c'est pour quand? 📅",
                type="question",
                suggestions=[f"Demain ({tomorrow_str})", "Aujourd'hui", "Dans 2 jours"],
                parsed_reminders=None
            )
        
        if not has_time:
            return ChatResponse(
                response="Et à quelle heure? ⏰",
                type="question",
                suggestions=["9h00", "14h00", "18h00"],
                parsed_reminders=None
            )
        
        # If we have all info, parse and confirm
        parsed = await parse_natural_language_message(message)
        
        encouragements = [
            "Parfait! C'est dans la boîte! 🚀",
            "Top! Je garde ça en tête! 😊",
            "Excellent! Une chose de moins à oublier! ✨"
        ]
        import random
        
        return ChatResponse(
            response=f"{random.choice(encouragements)}\n\n📝 {parsed.title}\n📅 {parsed.date}\n⏰ {parsed.time}",
            type="confirmation",
            suggestions=["Créer ce rappel", "Modifier", "Annuler"],
            parsed_reminders=[parsed]
        )
        
    except Exception as e:
        logger.error(f"Chat assistant error: {str(e)}")
        return ChatResponse(
            response="Oups! 😅 Peux-tu reformuler?",
            type="question",
            suggestions=["Réessayer", "Aide"],
            parsed_reminders=None
        )


# API Routes
@api_router.get("/")
async def root():
    return {"message": "API de rappels par message IA"}


@api_router.post("/parse-message", response_model=ParsedReminder)
async def parse_message(request: ParseMessageRequest):
    """Parse un message en langage naturel pour extraire les informations du rappel"""
    return await parse_natural_language_message(request.message)


@api_router.post("/chat", response_model=ChatResponse)
async def chat_assistant(request: ChatRequest):
    """Assistant IA conversationnel intelligent pour les utilisateurs TDAH"""
    return await intelligent_chat_assistant(request.message, request.conversation_history)


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


@app.on_event("startup")
async def startup_db():
    """Initialize database indexes on startup"""
    await init_db_indexes()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
