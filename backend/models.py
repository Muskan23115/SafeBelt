from sqlalchemy import Column, Integer, String, DateTime, Float, Text
from datetime import datetime
from .database import Base


class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    plate = Column(String(20), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    location = Column(String(200), nullable=True)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    # Base64-encoded JPEG thumbnail
    thumbnail_b64 = Column(Text, nullable=True)
    frame_id = Column(Integer, nullable=True)
