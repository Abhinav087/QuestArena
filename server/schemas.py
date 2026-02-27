from pydantic import BaseModel, Field


class AdminLoginRequest(BaseModel):
    password: str


class CreateSessionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    duration_minutes: int = Field(default=30, ge=5, le=240)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=40)


class ValidateTokenRequest(BaseModel):
    token: str


class SubmitAnswerRequest(BaseModel):
    level: int
    question_id: str
    answer: str


class SubmitCodeRequest(BaseModel):
    code: str


class AdjustScoreRequest(BaseModel):
    delta: int


class MoveLevelRequest(BaseModel):
    level: int = Field(ge=0, le=10)


class PlayerEventRequest(BaseModel):
    event_type: str
    details: str = ""


class FreezeLeaderboardRequest(BaseModel):
    frozen: bool


class SyncStateRequest(BaseModel):
    score: int = Field(ge=0)
    current_level: int = Field(ge=0, le=10)


class TimeAdjustRequest(BaseModel):
    minutes: int = Field(ge=1, le=60)
