import pytest
from pro.masking import is_pii_column, mask_value

def test_pii_detection():
    assert is_pii_column('email') is True
    assert is_pii_column('user_email') is True
    assert is_pii_column('phone_number') is True
    assert is_pii_column('last_name') is True
    assert is_pii_column('id') is False
    assert is_pii_column('created_at') is False

def test_mask_email():
    email = "john.doe@example.com"
    masked = mask_value(email, 'email')
    assert "@example.com" in masked
    assert "john.doe" not in masked
    assert len(masked) > 10

def test_mask_phone():
    phone = "+1-555-0199"
    masked = mask_value(phone, 'phone')
    assert "0199" in masked
    assert "555" not in masked
    assert masked.startswith("***-***-")

def test_mask_name():
    name = "John"
    masked = mask_value(name, 'first_name')
    assert len(masked) == 4
    assert name != masked
    # Check it's scrambled (only uppercase by default in my impl)
    assert masked.isupper()

def test_mask_default():
    val = "secret_token_123"
    masked = mask_value(val, 'token')
    assert val != masked
    assert len(masked) == 10 # MD5[:10]
