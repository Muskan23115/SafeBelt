"""
Vehicle Lookup API integration.

Reads VEHICLE_API_KEY from env. Calls a configurable endpoint to retrieve
owner, make/model, color, fuel type, insurance, and PUC status by plate.

Configuration env vars:
  VEHICLE_API_KEY  – required; your API provider key
  VEHICLE_API_URL  – optional; defaults to the RapidAPI vehicleinfo endpoint

On any error (missing key, network error, bad response) returns VehicleInfo
with all fields as None — the frontend then displays "—" for each.

Field name mapping (JSON path in response):
  owner_name       ← response["owner_name"]
  make_model       ← response["make_model"]  or response["vehicle_model"]
  color            ← response["color"]        or response["vehicle_color"]
  fuel_type        ← response["fuel_type"]
  insurance_status ← response["insurance_status"] → normalised to ACTIVE/EXPIRED
  puc_status       ← response["puc_status"]        → normalised to ACTIVE/EXPIRED

If your provider uses different field names, edit _parse() below.
"""
import logging
import os
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────
_API_KEY = os.environ.get("VEHICLE_API_KEY", "")
_API_URL  = os.environ.get(
    "VEHICLE_API_URL",
    "https://backend.vahandetails.com/api/get-rc-details",
)
_API_HOST = os.environ.get(
    "VEHICLE_API_HOST",
    "vehicle-registration-plate-detail.p.rapidapi.com",
)

# ── Data model ────────────────────────────────────────────────────────────────
@dataclass
class VehicleInfo:
    owner_name:       Optional[str] = None   # masked e.g. "S*****R S***H"
    make_model:       Optional[str] = None   # e.g. "MARUTI SUZUKI SWIFT"
    color:            Optional[str] = None   # e.g. "WHITE"
    fuel_type:        Optional[str] = None   # e.g. "PETROL" / "PETROL(E20)"
    insurance_status: Optional[str] = None   # "ACTIVE" | "EXPIRED"
    puc_status:       Optional[str] = None   # "ACTIVE" | "EXPIRED"


# ── Helpers ───────────────────────────────────────────────────────────────────
def _normalise_status(raw: Optional[str]) -> Optional[str]:
    """Coerce various provider wordings to ACTIVE or EXPIRED."""
    if raw is None:
        return None
    up = raw.strip().upper()
    if any(w in up for w in ("ACTIVE", "VALID", "YES", "1", "TRUE")):
        return "ACTIVE"
    if any(w in up for w in ("EXPIRE", "INVALID", "NO", "0", "FALSE", "LAPSED")):
        return "EXPIRED"
    return up  # pass through unknown values verbatim


def _str_or_none(d: dict, *keys: str) -> Optional[str]:
    """Return first non-empty value found in dict for any of the given keys."""
    for k in keys:
        v = d.get(k)
        if v and str(v).strip():
            return str(v).strip().upper()
    return None


def _parse(data: dict) -> VehicleInfo:
    """
    Map API response dict → VehicleInfo.
    Edit the key names here to match your actual API provider.
    """
    # Some providers nest data under a "result" or "data" key
    payload = data
    for nest in ("result", "data", "response", "vehicle_info"):
        if isinstance(data.get(nest), dict):
            payload = data[nest]
            break

    owner     = _str_or_none(payload,
                              "owner_name", "ownerName", "owner", "rc_owner_name")
    make_mdl  = _str_or_none(payload,
                              "make_model", "vehicle_model", "makeModel",
                              "rc_maker_model", "maker_model")
    color     = _str_or_none(payload,
                              "color", "vehicle_color", "vehicleColour",
                              "rc_colour", "colour")
    fuel      = _str_or_none(payload,
                              "fuel_type", "fuelType", "rc_fuel_desc",
                              "fuel_desc", "fuel")
    ins_raw   = _str_or_none(payload,
                              "insurance_status", "insuranceStatus",
                              "insurance_validity", "ins_status")
    puc_raw   = _str_or_none(payload,
                              "puc_status", "pucStatus",
                              "pucc_validity", "puc_validity")

    return VehicleInfo(
        owner_name       = owner,
        make_model       = make_mdl,
        color            = color,
        fuel_type        = fuel,
        insurance_status = _normalise_status(ins_raw),
        puc_status       = _normalise_status(puc_raw),
    )


# ── Public API ────────────────────────────────────────────────────────────────
def lookup(plate: str) -> VehicleInfo:
    """
    Fetch vehicle details for *plate* from the configured API.
    Returns VehicleInfo with all None fields on any error.
    """
    if not _API_KEY:
        logger.warning("VEHICLE_API_KEY not set — skipping vehicle lookup for plate %s", plate)
        return VehicleInfo()

    # Normalise plate: remove spaces, uppercase
    clean_plate = plate.replace(" ", "").upper()

    try:
        import httpx  # lazy import — keeps startup fast if httpx absent

        headers = {
    "Content-Type": "application/json",
    "x-api-key": _API_KEY,
    "Origin": "https://vahandetails.com",
    "Referer": "https://vahandetails.com/"
}

        resp = httpx.post(
            _API_URL,
            json={"rc_number": clean_plate},
            headers=headers,
            timeout=8.0,
        )

        if resp.status_code != 200:
            logger.warning(
                "Vehicle API returned %s for plate %s: %s",
                resp.status_code, plate, resp.text[:200],
            )
            return VehicleInfo()

        data = resp.json()
        info = _parse(data)
        logger.info("Vehicle lookup OK for %s → %s / %s", plate, info.make_model, info.owner_name)
        return info

    except ImportError:
        logger.error("httpx not installed — cannot call vehicle API. Run: pip install httpx")
        return VehicleInfo()
    except Exception as exc:
        logger.error("Vehicle lookup error for plate %s: %s", plate, exc)
        return VehicleInfo()
