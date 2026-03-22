"""
NPPES NPI Registry Integration
Real-time hospital lookup via CMS public API
https://npiregistry.cms.hhs.gov/api/

Falls back to verified local registry if CMS API is unreachable.
"""
import httpx
from typing import Optional

NPPES_API = "https://npiregistry.cms.hhs.gov/api/"

# Verified fallback registry — real NPIs from CMS NPPES
# Used as fallback if API is unreachable during demo
VERIFIED_FALLBACK = {
    '1497758544': {'hospital': 'Mayo Clinic',                        'city': 'Rochester, MN',   'type': 'Academic Medical Center', 'state': 'MN'},
    '1003835780': {'hospital': 'Johns Hopkins Hospital',             'city': 'Baltimore, MD',   'type': 'Academic Medical Center', 'state': 'MD'},
    '1174576452': {'hospital': 'Houston Methodist Hospital',         'city': 'Houston, TX',     'type': 'Community Hospital',      'state': 'TX'},
    '1598760593': {'hospital': 'UCLA Medical Center',                'city': 'Los Angeles, CA', 'type': 'Academic Medical Center', 'state': 'CA'},
    '1083611898': {'hospital': 'Rush University Medical Center',     'city': 'Chicago, IL',     'type': 'Academic Medical Center', 'state': 'IL'},
    '1558162840': {'hospital': 'Banner University Medical Center',   'city': 'Phoenix, AZ',     'type': 'Academic Medical Center', 'state': 'AZ'},
    '1003804844': {'hospital': 'University of Colorado Hospital',    'city': 'Aurora, CO',      'type': 'Academic Medical Center', 'state': 'CO'},
    '1023006684': {'hospital': 'Nebraska Medicine',                  'city': 'Omaha, NE',       'type': 'Academic Medical Center', 'state': 'NE'},
}

async def lookup_npi(npi: str) -> Optional[dict]:
    if not npi or len(npi) != 10 or not npi.isdigit():
        return {"error": "NPI must be exactly 10 digits"}
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            for enum_type in ["NPI-2", None]:
                params = {"number": npi, "version": "2.1"}
                if enum_type:
                    params["enumeration_type"] = enum_type
                resp = await client.get(NPPES_API, params=params)
                data = resp.json()
                results = data.get("results", [])
                if results:
                    break
            if not results:
                return None
            r = results[0]
            basic = r.get("basic", {})
            addresses = r.get("addresses", [])
            addr = next((a for a in addresses if a.get("address_purpose") == "LOCATION"), addresses[0] if addresses else {})
            org_name = (basic.get("organization_name") or "").strip()
            if not org_name:
                org_name = f"{basic.get('last_name','')} {basic.get('first_name','')}".strip()
            return {
                "npi": npi,
                "name": org_name,
                "status": basic.get("status", "A"),
                "city": addr.get("city", ""),
                "state": addr.get("state", ""),
                "zip": (addr.get("postal_code") or "")[:5],
                "address": addr.get("address_1", ""),
                "taxonomy": _get_primary_taxonomy(r.get("taxonomies", [])),
                "source": "nppes_live",
            }
    except Exception:
        # API unreachable — try verified fallback
        fallback = VERIFIED_FALLBACK.get(npi)
        if fallback:
            return {
                "npi": npi,
                "name": fallback["hospital"],
                "status": "A",
                "city": fallback["city"].split(",")[0],
                "state": fallback["state"],
                "zip": "",
                "address": "",
                "taxonomy": fallback["type"],
                "source": "verified_fallback",
            }
        return None

def _get_primary_taxonomy(taxonomies: list) -> str:
    if not taxonomies:
        return "Healthcare Organization"
    primary = next((t for t in taxonomies if t.get("primary")), taxonomies[0])
    desc = primary.get("desc", "Healthcare Organization")
    for keyword, label in [("hospital","Hospital"),("clinic","Clinic"),("physician","Medical Practice"),("nursing","Nursing Facility"),("university","Academic Medical Center"),("academic","Academic Medical Center")]:
        if keyword in desc.lower():
            return label
    return desc[:50]

async def validate_npi(npi: str) -> dict:
    result = await lookup_npi(npi)
    if result is None:
        return {"found": False, "error": "No organization found with this NPI number. Please verify at npiregistry.cms.hhs.gov"}
    if "error" in result:
        return {"found": False, "error": result["error"]}
    if result.get("status", "A").upper() != "A":
        return {"found": True, "active": False, "error": f"NPI is not active (status: {result.get('status')})", **result}
    city_state = f"{result['city']}, {result['state']}" if result.get("city") and result.get("state") else result.get("state", "")
    return {
        "found": True,
        "active": True,
        "hospital": result["name"],
        "city": city_state,
        "type": result["taxonomy"],
        "zip": result.get("zip", ""),
        "npi": npi,
        "address": result.get("address", ""),
        "source": result.get("source", "nppes_live"),
    }
