import os
import pytest
from app.security import encrypt_key, decrypt_key, get_encryption_key

def test_encryption_decryption():
    # Chuỗi test
    original_key = "gemini_secret_api_key_12345!"
    
    # Thực hiện mã hóa
    encrypted = encrypt_key(original_key)
    assert encrypted != original_key
    assert len(encrypted) > 0
    
    # Thực hiện giải mã
    decrypted = decrypt_key(encrypted)
    assert decrypted == original_key

def test_fallback_encryption_mechanism(monkeypatch):
    # Mock keyring to return None so that the system falls back to env-based key generation
    monkeypatch.setattr("keyring.get_password", lambda service, user: None)
    
    # Test cơ chế fallback khi thay đổi khóa chủ BEO_MASTER_KEY
    monkeypatch.setenv("BEO_MASTER_KEY", "custom_temp_secret_key_for_testing")
    key1 = get_encryption_key()
    
    monkeypatch.setenv("BEO_MASTER_KEY", "another_different_secret_key_for_testing")
    key2 = get_encryption_key()
    
    # Đảm bảo khóa thay đổi tương ứng
    assert key1 != key2

def test_empty_handling():
    assert encrypt_key("") == ""
    assert decrypt_key("") == ""
