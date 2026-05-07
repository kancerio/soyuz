import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    AI_MOCK_MODE = os.getenv("AI_MOCK_MODE", "true").lower() == "true"

settings = Settings()