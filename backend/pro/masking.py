import hashlib
import re
import random
import string

PII_PATTERNS = [
    r'email', r'phone', r'mobile', r'address', r'name', r'last_name', r'first_name',
    r'ssn', r'social_security', r'credit_card', r'card_number', r'password',
    r'secret', r'token', r'birth', r'dob', r'location', r'latitude', r'longitude'
]

def is_pii_column(column_name: str) -> bool:
    """
    Heuristic to detect if a column likely contains PII based on its name.
    """
    name_lower = column_name.lower()
    for pattern in PII_PATTERNS:
        if pattern in name_lower:
            return True
    return False

def mask_value(value: any, column_name: str) -> str:
    """
    Applies masking to a value based on the column type/name.
    """
    if value is None:
        return None
    
    val_str = str(value)
    name_lower = column_name.lower()

    if 'email' in name_lower:
        # Keep domain if possible, or just hash it
        if '@' in val_str:
            prefix, domain = val_str.split('@', 1)
            masked_prefix = hashlib.md5(prefix.encode()).hexdigest()[:8]
            return f"{masked_prefix}@{domain}"
        return hashlib.md5(val_str.encode()).hexdigest()[:12]

    if 'phone' in name_lower or 'mobile' in name_lower:
        # Keep last 4 digits
        digits = re.sub(r'\D', '', val_str)
        if len(digits) >= 4:
            return f"***-***-{digits[-4:]}"
        return "***-***-****"

    if 'name' in name_lower:
        # Scramble characters but keep length or just hash
        return ''.join(random.choices(string.ascii_uppercase, k=len(val_str)))

    # Default mask: Hash it
    return hashlib.md5(val_str.encode()).hexdigest()[:10]

def get_masking_map(columns: list[str]) -> dict[str, bool]:
    """
    Returns a map of column names to a boolean indicating if they should be masked.
    """
    return {col: is_pii_column(col) for col in columns}
